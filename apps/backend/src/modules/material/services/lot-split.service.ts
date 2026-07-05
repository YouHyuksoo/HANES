/**
 * @file src/modules/material/services/lot-split.service.ts
 * @description 자재 LOT 분할 비즈니스 로직 (TypeORM)
 *
 * 재설계(2026-06-08, spec: docs/specs/2026-06-08-lot-split-merge-redesign-design.md):
 * - 원 시리얼 전부 폐기(status='SPLIT', 재고0) → 결과 2조각을 모두 신규 시리얼로 발번(nextMatSerial).
 * - 입고완료(RECEIVE 합 >= initQty) LOT만 분할 가능(게이팅).
 * - 채번은 NumberingService 사용(시리얼: SEQ_MAT_SERIAL_DAILY, 수불: STOCK_TX).
 * - 추적은 origin(최초시리얼) 컬럼 계승으로 유지.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryRunner } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatIssue } from '../../../entities/mat-issue.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { LotSplitDto, LotSplitQueryDto } from '../dto/lot-split.dto';
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
export class LotSplitService {
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

  async findSplittableLots(query: LotSplitQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    // 분할 가능한 LOT: 입고완료(RECEIVE 합>=initQty) + 재고>1 + NORMAL 상태
    const qb = this.matLotRepository.createQueryBuilder('lot')
      .innerJoin(MatStock, 'stock', 'stock.matUid = lot.matUid AND stock.company = lot.company AND stock.plant = lot.plant')
      .where('stock.qty > 1')
      .andWhere("lot.status = 'NORMAL'")
      .andWhere('NVL(stock.reservedQty, 0) = 0')
      .andWhere(RECEIVED_GATE_SQL);

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });
    if (search) qb.andWhere('lot.matUid LIKE :search', { search: `%${search}%` });

    const [data, total] = await Promise.all([
      qb.orderBy('lot.createdAt', 'DESC')
        .skip(skip).take(limit).getMany(),
      qb.getCount(),
    ]);

    // part 정보 조회 및 중첩 객체 평면화
    const itemCodes = data.map((lot) => lot.itemCode).filter(Boolean);
    const tenantWhere = this.tenantWhere(company, plant);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // 재고 정보 조회
    const matUids = data.map((lot) => lot.matUid);
    const stocks = matUids.length > 0
      ? await this.matStockRepository.find({ where: { matUid: In(matUids), ...tenantWhere } })
      : [];
    const stockMap = new Map(stocks.map((s) => [s.matUid, s]));

    // 공급사(vendor) 코드 → 업체명 매핑 (IN 절 일괄 조회, N+1 회피)
    const vendorCodes = Array.from(
      new Set(data.map((lot) => lot.vendor).filter((v): v is string => !!v)),
    );
    const partners = vendorCodes.length > 0
      ? await this.partnerMasterRepository.find({ where: { partnerCode: In(vendorCodes), ...tenantWhere } })
      : [];
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    const flattenedData = data.map((lot) => {
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

    return { data: flattenedData, total, page, limit };
  }

  async split(dto: LotSplitDto, company?: string, plant?: string, userId?: string) {
    const { sourceLotId, splitQty, remark } = dto;
    const tenantWhere = this.tenantWhere(company, plant);

    return this.tx.run(async (queryRunner) => {
      // 1) 원본 LOT 조회 + 기본 상태 검증
      const sourceLot = await queryRunner.manager.findOne(MatLot, {
        where: { matUid: sourceLotId, ...tenantWhere },
      });
      if (!sourceLot) {
        throw new NotFoundException(`원본 LOT을 찾을 수 없습니다: ${sourceLotId}`);
      }
      this.assertSameTenant(sourceLot, company, plant, '원본 LOT');

      if (sourceLot.status === 'HOLD') {
        throw new BadRequestException('HOLD 상태인 LOT은 분할할 수 없습니다.');
      }
      if (sourceLot.status !== 'NORMAL') {
        throw new BadRequestException(`정상(NORMAL) 상태가 아닌 LOT은 분할할 수 없습니다. 현재 상태: ${sourceLot.status}`);
      }

      // 2) 입고완료 게이팅 (RECEIVE 합 >= initQty)
      await this.assertReceived(queryRunner, sourceLot);

      // 3) 원본 재고 조회 + 수량/예약 검증
      const sourceStock = await queryRunner.manager.findOne(MatStock, {
        where: { matUid: sourceLotId, ...tenantWhere },
      });
      if (!sourceStock || sourceStock.qty <= 0) {
        throw new BadRequestException(`분할할 재고가 없습니다. 현재 재고: ${sourceStock?.qty ?? 0}`);
      }
      this.assertSameTenant(sourceStock, sourceLot.company, sourceLot.plant, '원본 재고');
      if ((sourceStock.reservedQty ?? 0) > 0) {
        throw new BadRequestException('예약 수량이 있는 LOT는 분할할 수 없습니다. 예약부터 먼저 정리해 주세요.');
      }
      if (splitQty >= sourceStock.qty) {
        throw new BadRequestException(`분할 수량은 현재 재고보다 작아야 합니다. 현재: ${sourceStock.qty}, 요청: ${splitQty}`);
      }

      // 4) 출고이력 검증
      const issueHistories = await queryRunner.manager.find(MatIssue, {
        where: { matUid: sourceLotId, ...tenantWhere },
      });
      if (issueHistories.some((issue) => issue.status !== 'CANCELED')) {
        throw new BadRequestException(
          '이미 자재출고 이력이 있는 LOT는 분할할 수 없습니다. 자재출고부터 먼저 정리해 주세요.',
        );
      }

      // 5) 품목 정보 + 분할 가능 여부
      const part = await queryRunner.manager.findOne(ItemMaster, {
        where: { itemCode: sourceLot.itemCode, ...tenantWhere },
      });
      if (!part) {
        throw new NotFoundException(`품목을 찾을 수 없습니다: ${sourceLot.itemCode}`);
      }
      this.assertSameTenant(part, sourceLot.company, sourceLot.plant, '품목');
      if (part.isSplittable === 'N') {
        throw new BadRequestException(
          `해당 품목은 분할할 수 없습니다. 품번: ${part.itemCode}, 분할 설정: ${part.isSplittable}`,
        );
      }

      // ── 처리: 원본 전량 OUT → 신규 2조각 발번/IN ──
      const totalQty = sourceStock.qty;
      const remainQty = totalQty - splitQty; // 잔량 조각 (>0 보장됨)
      const warehouseCode = sourceStock.warehouseCode;
      const origin = sourceLot.origin || sourceLot.matUid;
      const splitRemark = remark || `자재분할: ${sourceLot.matUid} (${totalQty}) → ${splitQty} + ${remainQty}`;

      // 6) 원본 전량 OUT
      const outTransNo = await this.numbering.next('STOCK_TX', queryRunner, userId);
      await queryRunner.manager.save(StockTransaction, queryRunner.manager.create(StockTransaction, {
        transNo: outTransNo,
        transType: 'LOT_SPLIT_OUT',
        transDate: new Date(),
        fromWarehouseId: warehouseCode,
        itemCode: sourceLot.itemCode,
        matUid: sourceLot.matUid,
        qty: -totalQty,
        refType: 'LOT_SPLIT',
        refId: sourceLot.matUid,
        remark: splitRemark,
        workerId: userId ?? null,
        status: 'DONE',
        company: sourceLot.company,
        plant: sourceLot.plant,
        createdBy: userId ?? null,
      }));

      // 7) 원본 폐기 (status=SPLIT, 재고 0)
      await queryRunner.manager.update(MatLot, { matUid: sourceLot.matUid, ...tenantWhere }, {
        status: 'SPLIT',
        currentQty: 0,
        updatedBy: userId ?? null,
      });
      await queryRunner.manager.update(MatStock,
        { warehouseCode: sourceStock.warehouseCode, itemCode: sourceStock.itemCode, matUid: sourceStock.matUid, ...tenantWhere },
        { qty: 0, availableQty: 0, updatedBy: userId ?? null },
      );

      // 8) 신규 2조각 발번/생성/IN
      const pieces: number[] = [splitQty, remainQty];
      const created: Array<{ matUid: string; qty: number }> = [];
      for (const qty of pieces) {
        const newSerial = await this.numbering.nextMatSerial(queryRunner);
        await this.createChildLot(queryRunner, sourceLot, sourceStock, origin, newSerial, qty, userId);

        const inTransNo = await this.numbering.next('STOCK_TX', queryRunner, userId);
        await queryRunner.manager.save(StockTransaction, queryRunner.manager.create(StockTransaction, {
          transNo: inTransNo,
          transType: 'LOT_SPLIT_IN',
          transDate: new Date(),
          toWarehouseId: warehouseCode,
          itemCode: sourceLot.itemCode,
          matUid: newSerial,
          qty,
          refType: 'LOT_SPLIT',
          refId: sourceLot.matUid,
          remark: splitRemark,
          workerId: userId ?? null,
          status: 'DONE',
          company: sourceLot.company,
          plant: sourceLot.plant,
          createdBy: userId ?? null,
        }));

        created.push({ matUid: newSerial, qty });
      }

      return {
        sourceLotNo: sourceLot.matUid,
        itemCode: part.itemCode,
        itemName: part.itemName,
        arrivalNo: sourceLot.arrivalNo,
        results: created,
        // MatLabelPreviewModal 재사용용 라벨 데이터
        label: {
          arrivalNo: sourceLot.arrivalNo ?? '',
          serials: created.map((c, idx) => ({
            matUid: c.matUid,
            initQty: c.qty,
            arrivalSeq: idx + 1,
            itemCode: part.itemCode,
          })),
        },
      };
    });
  }

  /** 입고완료 게이팅 검증 (트랜잭션 내) */
  private async assertReceived(queryRunner: QueryRunner, lot: MatLot): Promise<void> {
    const rows = await queryRunner.manager.query(
      `SELECT NVL(SUM(st."QTY"), 0) AS "RECVD" FROM "STOCK_TRANSACTIONS" st` +
      ` WHERE st."MAT_UID" = :1 AND st."TRANS_TYPE" IN (${RECEIVED_TRANS_TYPES}) AND st."STATUS" <> 'CANCELED'`,
      [lot.matUid],
    );
    const received = Number(rows[0]?.RECVD ?? rows[0]?.recvd ?? 0);
    if (received < lot.initQty) {
      throw new BadRequestException(
        `입고완료된 LOT만 분할할 수 있습니다. 입고확정(입고처리)을 먼저 진행해 주세요: ${lot.matUid}`,
      );
    }
  }

  /** 신규 조각 LOT + MatStock 생성 (원본 속성 계승, currentQty 반드시 설정) */
  private async createChildLot(
    queryRunner: QueryRunner,
    sourceLot: MatLot,
    sourceStock: MatStock,
    origin: string,
    newSerial: string,
    qty: number,
    userId?: string,
  ): Promise<void> {
    const newLot = queryRunner.manager.create(MatLot, {
      matUid: newSerial,
      itemCode: sourceLot.itemCode,
      initQty: qty,
      currentQty: qty,
      recvDate: sourceLot.recvDate,
      manufactureDate: sourceLot.manufactureDate,
      expireDate: sourceLot.expireDate,
      arrivalNo: sourceLot.arrivalNo,
      arrivalSeq: sourceLot.arrivalSeq,
      origin,
      vendor: sourceLot.vendor,
      mfgPartnerCode: sourceLot.mfgPartnerCode,
      invoiceNo: sourceLot.invoiceNo,
      poNo: sourceLot.poNo,
      iqcStatus: sourceLot.iqcStatus,
      status: 'NORMAL',
      company: sourceLot.company,
      plant: sourceLot.plant,
      createdBy: userId ?? null,
    });
    await queryRunner.manager.save(newLot);

    const newStock = queryRunner.manager.create(MatStock, {
      warehouseCode: sourceStock.warehouseCode,
      locationCode: sourceStock.locationCode,
      itemCode: sourceStock.itemCode,
      matUid: newSerial,
      qty,
      availableQty: qty,
      reservedQty: 0,
      company: sourceStock.company,
      plant: sourceStock.plant,
      createdBy: userId ?? null,
    });
    await queryRunner.manager.save(newStock);
  }
}
