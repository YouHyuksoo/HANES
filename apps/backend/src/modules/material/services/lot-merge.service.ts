/**
 * @file src/modules/material/services/lot-merge.service.ts
 * @description 자재 LOT 병합 비즈니스 로직 (TypeORM)
 *
 * 재설계(2026-06-08, spec: docs/specs/2026-06-08-lot-split-merge-redesign-design.md):
 * - 원 시리얼 전부 폐기(status='MERGED', 재고0) → 합산 수량의 신규 통합 시리얼 1개 발번.
 * - 동일 itemCode + 동일 입하번호(arrivalNo) + 입고완료 LOT만 병합 가능.
 *   (입하건 단위 병합 — 입하 라벨 재부착을 위해 동일 입하건으로 제한)
 * - 채번은 NumberingService 사용(시리얼: SEQ_MAT_SERIAL_DAILY, 수불: STOCK_TX).
 * - 프론트는 바코드 스캔으로 대상 누적(GET by-barcode로 단건 검증).
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryRunner, EntityManager } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { LotMergeDto, LotMergeQueryDto } from '../dto/lot-merge.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { NumberingService } from '../../../shared/numbering.service';

/**
 * 입고완료 게이팅: 해당 matUid의 유효 입고(RECEIVE + 분할/병합 IN) 합 >= INIT_QTY.
 * 분할/병합 결과 시리얼도 재가공(재분할·재병합) 가능하도록 LOT_SPLIT_IN/LOT_MERGE_IN을 입고완료로 인정.
 */
const RECEIVED_TRANS_TYPES = "'RECEIVE','LOT_SPLIT_IN','LOT_MERGE_IN'";
const RECEIVED_GATE_SQL =
  `lot.initQty <= NVL((SELECT SUM(st."QTY") FROM "STOCK_TRANSACTIONS" st` +
  ` WHERE st."MAT_UID" = lot.matUid AND st."TRANS_TYPE" IN (${RECEIVED_TRANS_TYPES}) AND st."STATUS" <> 'CANCELED'), 0)`;

@Injectable()
export class LotMergeService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatIssue)
    private readonly matIssueRepository: Repository<MatIssue>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    private readonly tx: TransactionService,
    private readonly numbering: NumberingService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    row: { company?: string | null; plant?: string | null } | null | undefined,
    company?: string | null,
    plant?: string | null,
    context = '데이터',
  ) {
    if (company && row?.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row?.company ?? 'NULL'}`);
    }
    if (plant && row?.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row?.plant ?? 'NULL'}`);
    }
  }

  async findMergeableLots(query: LotMergeQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, itemCode } = query;
    const skip = (page - 1) * limit;

    const qb = this.matLotRepository.createQueryBuilder('lot')
      .innerJoin(MatStock, 'stock', 'stock.matUid = lot.matUid AND stock.company = lot.company AND stock.plant = lot.plant')
      .where('stock.qty > 0')
      .andWhere("lot.status = 'NORMAL'")
      .andWhere('NVL(stock.reservedQty, 0) = 0')
      .andWhere(RECEIVED_GATE_SQL);

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });
    if (itemCode) qb.andWhere('lot.itemCode = :itemCode', { itemCode });
    if (search) {
      qb.andWhere('(lot.matUid LIKE :search OR lot.itemCode LIKE :search)', { search: `%${search}%` });
    }

    const [lots, total] = await Promise.all([
      qb.orderBy('lot.itemCode', 'ASC')
        .addOrderBy('lot.origin', 'ASC')
        .addOrderBy('lot.matUid', 'ASC')
        .skip(skip).take(limit).getMany(),
      qb.getCount(),
    ]);

    const data = await this.attachMeta(lots, company, plant);
    return { data, total, page, limit };
  }

  /** 바코드 스캔 단건 조회 — 병합 후보 자격을 검증해 반환 (프론트 누적용) */
  async findByBarcode(matUid: string, company?: string, plant?: string) {
    const tenantWhere = this.tenantWhere(company, plant);
    const lot = await this.matLotRepository.findOne({ where: { matUid, ...tenantWhere } });
    if (!lot) {
      throw new NotFoundException(`해당 시리얼을 찾을 수 없습니다: ${matUid}`);
    }
    this.assertSameTenant(lot, company, plant, '시리얼');

    if (lot.status === 'HOLD') {
      throw new BadRequestException(`HOLD 상태인 LOT은 병합할 수 없습니다: ${matUid}`);
    }
    if (lot.status !== 'NORMAL') {
      throw new BadRequestException(`정상(NORMAL) 상태가 아닌 LOT은 병합할 수 없습니다. 현재 상태: ${lot.status}`);
    }

    const stock = await this.matStockRepository.findOne({ where: { matUid, ...tenantWhere } });
    if (!stock || stock.qty <= 0) {
      throw new BadRequestException(`재고가 없는 LOT은 병합할 수 없습니다: ${matUid}`);
    }
    if ((stock.reservedQty ?? 0) > 0) {
      throw new BadRequestException(`예약 수량이 있는 LOT은 병합할 수 없습니다: ${matUid}`);
    }

    // 입고완료 게이팅
    const received = await this.receivedQty(this.matLotRepository.manager, matUid);
    if (received < lot.initQty) {
      throw new BadRequestException(`입고완료된 LOT만 병합할 수 있습니다. 입고확정을 먼저 진행해 주세요: ${matUid}`);
    }

    // 출고이력
    const issues = await this.matIssueRepository.find({ where: { matUid, ...tenantWhere } });
    if (issues.some((i) => i.status !== 'CANCELED')) {
      throw new BadRequestException(`이미 자재출고 이력이 있는 LOT은 병합할 수 없습니다: ${matUid}`);
    }

    const [meta] = await this.attachMeta([lot], company, plant);
    return meta;
  }

  async merge(dto: LotMergeDto, company?: string, plant?: string, userId?: string) {
    const { sourceLotIds, remark } = dto;
    const tenantWhere = this.tenantWhere(company, plant);
    const uniqueIds = [...new Set(sourceLotIds)];
    if (uniqueIds.length < 2) {
      throw new BadRequestException('병합하려면 서로 다른 2개 이상의 LOT이 필요합니다.');
    }

    return this.tx.run(async (queryRunner) => {
      // 1) 모든 LOT 조회
      const lots = await queryRunner.manager.find(MatLot, {
        where: { matUid: In(uniqueIds), ...tenantWhere },
      });
      if (lots.length !== uniqueIds.length) {
        const found = new Set(lots.map((l) => l.matUid));
        const missing = uniqueIds.filter((id) => !found.has(id));
        throw new NotFoundException(`존재하지 않는 LOT이 있습니다: ${missing.join(', ')}`);
      }
      lots.forEach((lot) => this.assertSameTenant(lot, company, plant, `LOT ${lot.matUid}`));

      // 2) 동일 품목 검증
      const itemCodes = new Set(lots.map((l) => l.itemCode));
      if (itemCodes.size > 1) {
        throw new BadRequestException('서로 다른 품목의 LOT은 병합할 수 없습니다.');
      }

      // 3) 동일 입하번호(arrivalNo) 검증 — 같은 입하건의 LOT만 병합 가능
      const arrivalNos = new Set(lots.map((l) => l.arrivalNo ?? ''));
      if (arrivalNos.has('')) {
        throw new BadRequestException('입하번호가 없는 LOT은 병합할 수 없습니다.');
      }
      if (arrivalNos.size > 1) {
        throw new BadRequestException('입하번호가 동일한 LOT만 병합할 수 있습니다.');
      }

      // 4) 재고 조회
      const stocks = await queryRunner.manager.find(MatStock, {
        where: { matUid: In(uniqueIds), ...tenantWhere },
      });
      const stockMap = new Map(stocks.map((s) => [s.matUid, s]));

      // 5) 상태/재고/예약/입고완료 검증
      for (const lot of lots) {
        if (lot.status === 'HOLD') {
          throw new BadRequestException(`HOLD 상태인 LOT은 병합할 수 없습니다: ${lot.matUid}`);
        }
        if (lot.status !== 'NORMAL') {
          throw new BadRequestException(`정상(NORMAL) 상태가 아닌 LOT은 병합할 수 없습니다: ${lot.matUid} (${lot.status})`);
        }
        const lotStock = stockMap.get(lot.matUid);
        if (!lotStock || lotStock.qty <= 0) {
          throw new BadRequestException(`재고가 없는 LOT은 병합할 수 없습니다: ${lot.matUid}`);
        }
        this.assertSameTenant(lotStock, lot.company, lot.plant, `재고 ${lot.matUid}`);
        if ((lotStock.reservedQty ?? 0) > 0) {
          throw new BadRequestException(`예약 수량이 있는 LOT은 병합할 수 없습니다: ${lot.matUid}`);
        }
        const received = await this.receivedQty(queryRunner.manager, lot.matUid);
        if (received < lot.initQty) {
          throw new BadRequestException(`입고완료된 LOT만 병합할 수 있습니다. 입고확정을 먼저 진행해 주세요: ${lot.matUid}`);
        }
      }

      // 6) 출고이력 검증
      const issueHistories = await queryRunner.manager.find(MatIssue, {
        where: { matUid: In(uniqueIds), ...tenantWhere },
      });
      const activeIssueLotNos = [...new Set(
        issueHistories.filter((i) => i.status !== 'CANCELED').map((i) => i.matUid),
      )];
      if (activeIssueLotNos.length > 0) {
        throw new BadRequestException(
          `이미 자재출고 이력이 있는 LOT은 병합할 수 없습니다. 자재출고부터 먼저 정리해 주세요: ${activeIssueLotNos.join(', ')}`,
        );
      }

      // 7) 품목 정보
      const part = await queryRunner.manager.findOne(ItemMaster, {
        where: { itemCode: lots[0].itemCode, ...tenantWhere },
      });
      if (!part) {
        throw new NotFoundException(`품목을 찾을 수 없습니다: ${lots[0].itemCode}`);
      }
      this.assertSameTenant(part, lots[0].company, lots[0].plant, `품목 ${lots[0].itemCode}`);

      // ── 처리 ──
      const base = lots[0];
      const origin = base.origin || base.matUid;
      const totalQty = lots.reduce((sum, l) => sum + (stockMap.get(l.matUid)?.qty ?? 0), 0);
      const warehouseCode = stockMap.get(base.matUid)?.warehouseCode ?? null;
      // 유효기한은 가장 이른 일자를 보수적으로 계승
      const expireDate = lots.reduce<Date | null>((min, l) => {
        if (!l.expireDate) return min;
        if (!min) return l.expireDate;
        return l.expireDate < min ? l.expireDate : min;
      }, null);
      const sourceNos = lots.map((l) => l.matUid).join(', ');
      const mergeRemark = remark || `자재병합: [${sourceNos}] → 신규 (${totalQty})`;

      // 8) 원 시리얼 전부 OUT + 폐기(MERGED)
      for (const lot of lots) {
        const lotStock = stockMap.get(lot.matUid)!;
        const outTransNo = await this.numbering.next('STOCK_TX', queryRunner, userId);
        await queryRunner.manager.save(StockTransaction, queryRunner.manager.create(StockTransaction, {
          transNo: outTransNo,
          transType: 'LOT_MERGE_OUT',
          transDate: new Date(),
          fromWarehouseId: lotStock.warehouseCode,
          itemCode: lot.itemCode,
          matUid: lot.matUid,
          qty: -lotStock.qty,
          refType: 'LOT_MERGE',
          refId: lot.matUid,
          remark: mergeRemark,
          workerId: userId ?? null,
          status: 'DONE',
          company: lot.company,
          plant: lot.plant,
          createdBy: userId ?? null,
        }));

        await queryRunner.manager.update(MatLot, { matUid: lot.matUid, ...tenantWhere }, {
          status: 'MERGED',
          currentQty: 0,
          updatedBy: userId ?? null,
        });
        await queryRunner.manager.update(MatStock,
          { warehouseCode: lotStock.warehouseCode, itemCode: lotStock.itemCode, matUid: lotStock.matUid, ...tenantWhere },
          { qty: 0, availableQty: 0, updatedBy: userId ?? null },
        );
      }

      // 9) 신규 통합 시리얼 발번/생성
      const newSerial = await this.numbering.nextMatSerial(queryRunner);
      const baseStock = stockMap.get(base.matUid)!;
      const newLot = queryRunner.manager.create(MatLot, {
        matUid: newSerial,
        itemCode: base.itemCode,
        initQty: totalQty,
        currentQty: totalQty,
        recvDate: base.recvDate,
        manufactureDate: base.manufactureDate,
        expireDate,
        arrivalNo: base.arrivalNo,
        arrivalSeq: base.arrivalSeq,
        origin,
        vendor: base.vendor,
        mfgPartnerCode: base.mfgPartnerCode,
        invoiceNo: base.invoiceNo,
        poNo: base.poNo,
        iqcStatus: base.iqcStatus,
        status: 'NORMAL',
        company: base.company,
        plant: base.plant,
        createdBy: userId ?? null,
      });
      await queryRunner.manager.save(newLot);

      await queryRunner.manager.save(MatStock, queryRunner.manager.create(MatStock, {
        warehouseCode: baseStock.warehouseCode,
        locationCode: baseStock.locationCode,
        itemCode: base.itemCode,
        matUid: newSerial,
        qty: totalQty,
        availableQty: totalQty,
        reservedQty: 0,
        company: base.company,
        plant: base.plant,
        createdBy: userId ?? null,
      }));

      // 10) 신규 IN
      const inTransNo = await this.numbering.next('STOCK_TX', queryRunner, userId);
      await queryRunner.manager.save(StockTransaction, queryRunner.manager.create(StockTransaction, {
        transNo: inTransNo,
        transType: 'LOT_MERGE_IN',
        transDate: new Date(),
        toWarehouseId: warehouseCode,
        itemCode: base.itemCode,
        matUid: newSerial,
        qty: totalQty,
        refType: 'LOT_MERGE',
        refId: origin, // 원본 목록은 remark에 기록(refId 50자 제한)
        remark: mergeRemark,
        workerId: userId ?? null,
        status: 'DONE',
        company: base.company,
        plant: base.plant,
        createdBy: userId ?? null,
      }));

      return {
        newLotNo: newSerial,
        mergedLotNos: lots.map((l) => l.matUid),
        totalQty,
        itemCode: part.itemCode,
        itemName: part.itemName,
        arrivalNo: base.arrivalNo,
        // MatLabelPreviewModal 재사용용 라벨 데이터
        label: {
          arrivalNo: base.arrivalNo ?? '',
          serials: [{
            matUid: newSerial,
            initQty: totalQty,
            arrivalSeq: base.arrivalSeq ?? 1,
            itemCode: part.itemCode,
          }],
        },
      };
    });
  }

  /** matUid의 RECEIVE(취소 제외) 합계 */
  private async receivedQty(manager: EntityManager, matUid: string): Promise<number> {
    const rows = await manager.query(
      `SELECT NVL(SUM(st."QTY"), 0) AS "RECVD" FROM "STOCK_TRANSACTIONS" st` +
      ` WHERE st."MAT_UID" = :1 AND st."TRANS_TYPE" IN (${RECEIVED_TRANS_TYPES}) AND st."STATUS" <> 'CANCELED'`,
      [matUid],
    );
    return Number(rows[0]?.RECVD ?? rows[0]?.recvd ?? 0);
  }

  /** LOT 목록에 품목명/단위/재고수량 메타 부착 */
  private async attachMeta(lots: MatLot[], company?: string, plant?: string) {
    if (lots.length === 0) return [];
    const tenantWhere = this.tenantWhere(company, plant);
    const itemCodes = [...new Set(lots.map((l) => l.itemCode).filter(Boolean))];
    const matUids = lots.map((l) => l.matUid);
    const vendorCodes = [...new Set(lots.map((l) => l.vendor).filter((v): v is string => Boolean(v)))];

    const [parts, stocks, partners] = await Promise.all([
      itemCodes.length > 0
        ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere }, select: ['itemCode', 'itemName', 'unit'] })
        : Promise.resolve([]),
      this.matStockRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }),
      vendorCodes.length > 0
        ? this.partnerMasterRepository.find({ where: { partnerCode: In(vendorCodes), ...tenantWhere }, select: ['partnerCode', 'partnerName'] })
        : Promise.resolve([]),
    ]);
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const stockMap = new Map(stocks.map((s) => [s.matUid, s]));
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    return lots.map((lot) => {
      const part = partMap.get(lot.itemCode);
      const stock = stockMap.get(lot.matUid);
      return {
        ...lot,
        itemCode: lot.itemCode,
        itemName: part?.itemName ?? null,
        unit: part?.unit ?? null,
        qty: stock?.qty ?? 0,
        warehouseCode: stock?.warehouseCode ?? null,
        vendorName: lot.vendor ? (partnerMap.get(lot.vendor) ?? lot.vendor) : null,
      };
    });
  }
}
