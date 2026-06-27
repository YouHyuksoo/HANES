/**
 * @file src/modules/material/services/receiving.service.ts
 * @description 입고관리 비즈니스 로직 - IQC 합격건 일괄/분할 입고 확정 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **입고 대상**: LOT.iqcStatus='PASS'이고 아직 입고 미완료인 건
 * 2. **입고 완료 판단**: 해당 LOT에 대한 RECEIVE 트랜잭션 합계가 initQty 이상이면 완료
 * 3. **분할 입고**: LOT의 일부 수량만 입고 가능 (잔량 = initQty - 기입고수량)
 * 4. **Stock 반영**: 입고 시 대상 창고에 Stock upsert
 * 5. **MatReceiving**: 입고 전용 테이블로 업무 관리, StockTransaction은 수불원장
 *
 * NOTE: 기존 lotNo 필드는 matUid로 리네이밍됨 (자재 고유 식별자)
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, DataSource, EntityManager, MoreThan } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatArrivalStock } from '../../../entities/mat-arrival-stock.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PartnerMaster } from '../../../entities/partner-master.entity';
import { IqcLog } from '../../../entities/iqc-log.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { LabelPrintLog } from '../../../entities/label-print-log.entity';
import { CreateBulkReceiveDto, ReceivingQueryDto } from '../dto/receiving.dto';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';
import { SysConfigService } from '../../system/services/sys-config.service';

@Injectable()
export class ReceivingService {
  constructor(
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(MatArrival)
    private readonly matArrivalRepository: Repository<MatArrival>,
    @InjectRepository(MatReceiving)
    private readonly matReceivingRepository: Repository<MatReceiving>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
    @InjectRepository(PartnerMaster)
    private readonly partnerMasterRepository: Repository<PartnerMaster>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(LabelPrintLog)
    private readonly labelPrintLogRepository: Repository<LabelPrintLog>,
    @InjectRepository(IqcLog)
    private readonly iqcLogRepository: Repository<IqcLog>,
    private readonly dataSource: DataSource,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
    private readonly sysConfigService: SysConfigService,
  ) {}

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

  /** 입고 가능 LOT 목록 (IQC 합격 + 미입고/부분입고) */
  async findReceivable(company?: string, plant?: string) {
    // 입고 대상 LOT 조회 (initQty > 0 조건으로 유효 LOT 필터)
    // - IQC 합격(PASS) LOT
    // - IQC 불합격(FAIL)이지만 특채(SPECIAL_ACCEPT_YN='Y') 승인된 LOT → 양품입고 허용
    const qb = this.matLotRepository.createQueryBuilder('lot')
      .where("(lot.iqcStatus = 'PASS' OR (lot.iqcStatus = 'FAIL' AND lot.specialAcceptYn = 'Y'))")
      .andWhere('lot.status IN (:...statuses)', { statuses: ['NORMAL', 'HOLD'] })
      .andWhere('lot.initQty > 0');

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });

    const validLots = await qb.orderBy('lot.createdAt', 'DESC').getMany();
    const matUids = validLots.map((l) => l.matUid);

    if (matUids.length === 0) {
      return [];
    }

    // 각 LOT의 기입고수량 계산 (RECEIVE 트랜잭션 합계)
    const receiveTxs = await this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('tx.matUid', 'matUid')
      .addSelect('SUM(tx.qty)', 'sumQty')
      .where('tx.matUid IN (:...matUids)', { matUids })
      .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
      .andWhere('tx.status = :status', { status: 'DONE' })
      .andWhere(company ? 'tx.company = :company' : '1=1', { company })
      .andWhere(plant ? 'tx.plant = :plant' : '1=1', { plant })
      .groupBy('tx.matUid')
      .getRawMany();

    const receivedMap = new Map<string, number>();
    for (const tx of receiveTxs) {
      if (tx.matUid) receivedMap.set(tx.matUid, parseInt(tx.sumQty) || 0);
    }

    // MAT_ARRIVALS에서 LOT이 생성된 입하 건의 창고 정보 가져오기
    const arrivalKeys = validLots
      .filter((lot) => lot.arrivalNo && lot.arrivalSeq != null && lot.itemCode)
      .map((lot) => ({
        arrivalNo: lot.arrivalNo!,
        seq: lot.arrivalSeq!,
        itemCode: lot.itemCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      }));
    const arrivalRecords = arrivalKeys.length > 0
      ? await this.matArrivalRepository.find({
          where: arrivalKeys,
          select: ['arrivalNo', 'seq', 'itemCode', 'warehouseCode'],
          order: { arrivalDate: 'DESC' },
        })
      : [];

    const arrivalWhByLotKey = new Map<string, string>();
    for (const arr of arrivalRecords) {
      if (arr.arrivalNo && arr.seq != null && arr.itemCode && arr.warehouseCode) {
        arrivalWhByLotKey.set(`${arr.arrivalNo}::${arr.seq}::${arr.itemCode}`, arr.warehouseCode);
      }
    }

    // 기본 창고(양품창고) 조회 - 입고 시 기본 선택값
    const defaultWarehouse = await this.warehouseRepository.findOne({
      where: { isDefault: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    // 창고 정보 조회 (warehouseCode 기준)
    const warehouseCodes = [...new Set(arrivalWhByLotKey.values())].filter(Boolean);
    const warehouseIds = [] as string[]; // 호환용
    const warehouses = warehouseCodes.length > 0
      ? await this.warehouseRepository.find({
          where: { warehouseCode: In(warehouseCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        })
      : [];
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // part 정보 조회
    const itemCodes = validLots.map((lot) => lot.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.itemMasterRepository.find({
          where: { itemCode: In(itemCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // 공급사명 해소 (MAT_LOTS.VENDOR → PARTNER_MASTERS.PARTNER_NAME, IN 절 일괄 조회)
    const vendorCodes = [...new Set(validLots.map((lot) => lot.vendor).filter(Boolean))] as string[];
    const vendorPartners = vendorCodes.length > 0
      ? await this.partnerMasterRepository.find({
          where: { partnerCode: In(vendorCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        })
      : [];
    const vendorNameMap = new Map(vendorPartners.map((p) => [p.partnerCode, p.partnerName]));

    const arrivalNos = [...new Set(validLots.map((lot) => lot.arrivalNo).filter(Boolean))] as string[];
    const passedIqcLogs = arrivalNos.length > 0 && itemCodes.length > 0
      ? await this.iqcLogRepository.find({
          where: {
            arrivalNo: In(arrivalNos),
            itemCode: In(itemCodes),
            result: 'PASS',
            status: 'DONE',
            ...this.tenantWhere(company, plant),
          },
          order: { inspectDate: 'DESC' },
        })
      : [];
    const iqcLogByArrivalItem = new Map<string, IqcLog>();
    for (const log of passedIqcLogs) {
      if (!log.arrivalNo || !log.itemCode) continue;
      const key = `${log.arrivalNo}::${log.itemCode}`;
      if (!iqcLogByArrivalItem.has(key)) iqcLogByArrivalItem.set(key, log);
    }

    // 라벨 발행 여부 확인 (LABEL_PRINT_LOGS에서 성공 이력 조회)
    const printLogs = await this.labelPrintLogRepository
      .createQueryBuilder('log')
      .select('log.uidList')
      .where('log.category = :cat', { cat: 'mat_lot' })
      .andWhere('log.status = :st', { st: 'SUCCESS' })
      .getMany();

    const printedLotNos = new Set<string>();
    for (const log of printLogs) {
      if (log.uidList) {
        try {
          const ids = JSON.parse(log.uidList);
          if (Array.isArray(ids)) {
            ids.forEach((id: string) => printedLotNos.add(id));
          }
        } catch { /* ignore parse errors */ }
      }
    }

    return validLots
      .map((lot) => {
        const receivedQty = receivedMap.get(lot.matUid) || 0;
        const remainingQty = lot.initQty - receivedQty;
        const arrivalWhCode = lot.arrivalNo && lot.arrivalSeq != null
          ? arrivalWhByLotKey.get(`${lot.arrivalNo}::${lot.arrivalSeq}::${lot.itemCode}`)
          : null;
        const arrivalWarehouse = arrivalWhCode ? warehouseMap.get(arrivalWhCode) : null;
        const part = partMap.get(lot.itemCode);
        const isConcession = lot.iqcStatus === 'FAIL' && lot.specialAcceptYn === 'Y';
        const iqcLog = lot.arrivalNo
          ? iqcLogByArrivalItem.get(`${lot.arrivalNo}::${lot.itemCode}`)
          : null;

        return {
          ...lot,
          // 공급사명(VENDOR 코드 → PARTNER_NAME)
          vendorName: lot.vendor ? (vendorNameMap.get(lot.vendor) ?? lot.vendor) : null,
          receivedQty,
          remainingQty,
          arrivalWarehouse: arrivalWarehouse || null,
          part: part ? { id: part.itemCode, itemCode: part.itemCode, itemName: part.itemName, unit: part.unit } : null,
          expiryDays: part?.expiryDate || 0,
          arrivalWarehouseCode: arrivalWarehouse?.warehouseCode || defaultWarehouse?.warehouseCode,
          arrivalWarehouseName: arrivalWarehouse?.warehouseName || defaultWarehouse?.warehouseName,
          labelPrinted: printedLotNos.has(lot.matUid),
          certRequired: false,
          certUploaded: !!iqcLog?.certFilePath,
          isConcession,
          receivingBlockedReason: null,
        };
      })
      .filter((lot) => lot.remainingQty > 0);
  }

  /**
   * 단건 입고가능 LOT 조회 (PDA 시리얼 스캔용)
   * - 웹/PDA 입고 워크플로우 통일: 시리얼(matUid) 바코드 스캔 → 입고가능 LOT 반환
   * - findReceivable의 검증/가공 로직을 재사용해 동일 계약 보장
   */
  async findReceivableByBarcode(matUid: string, company?: string, plant?: string) {
    const code = matUid?.trim();
    if (!code) throw new BadRequestException('바코드(시리얼)를 입력해 주세요.');
    const list = await this.findReceivable(company, plant);
    const lot = list.find((l) => l.matUid === code);
    if (!lot) {
      throw new NotFoundException(`입고 가능한 LOT이 아닙니다(미검사/입고완료/대상아님): ${code}`);
    }
    if (lot.receivingBlockedReason) {
      throw new BadRequestException(`${code}: ${lot.receivingBlockedReason}`);
    }
    return lot;
  }

  /**
   * PO 수량 오차율 체크
   * - LOT의 PO 번호를 기준으로 주문 수량 대비 입고 수량이 오차율 내인지 확인
   * - 초과 시 BadRequestException 발생
   */
  private async checkPoTolerance(lot: MatLot, receiveQty: number): Promise<void> {
    if (!lot.poNo) return; // PO 번호가 없으면 체크 불필요
    const tenantWhere = this.tenantWhere(lot.company, lot.plant);

    // PO 조회 (PO 번호로)
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo: lot.poNo, ...tenantWhere },
    });
    if (!po) return; // PO 정보 없으면 체크 불필요

    // PO 품목 조회
    const poItem = await this.purchaseOrderItemRepository.findOne({
      where: { poNo: po.poNo, itemCode: lot.itemCode, ...tenantWhere },
    });
    if (!poItem) return; // PO 품목 정보 없으면 체크 불필요

    // 품목의 오차율 조회
    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: lot.itemCode, ...tenantWhere },
      select: ['itemCode', 'toleranceRate'],
    });
    const toleranceRate = part?.toleranceRate ?? 5.0; // 기본값 5%

    // 해당 PO의 기 입고 수량 조회 (동일 품목 기준)
    const receivedAgg = await this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.qty)', 'sumQty')
      .where('tx.transType = :transType', { transType: 'RECEIVE' })
      .andWhere('tx.status = :status', { status: 'DONE' })
      .andWhere('tx.itemCode = :itemCode', { itemCode: lot.itemCode })
      .andWhere(
        `tx.matUid IN (
          SELECT mat_uid FROM mat_lots
          WHERE po_no = :poNo
          ${lot.company ? 'AND company = :company' : ''}
          ${lot.plant ? 'AND plant_cd = :plant' : ''}
        )`,
        { poNo: lot.poNo, company: lot.company, plant: lot.plant }
      )
      .getRawOne();

    const alreadyReceived = parseInt(receivedAgg?.sumQty) || 0;
    const willBeReceived = alreadyReceived + receiveQty;
    const orderQty = poItem.orderQty;

    // 오차율 계산
    const upperLimit = orderQty * (1 + toleranceRate / 100);
    const lowerLimit = orderQty * (1 - toleranceRate / 100);

    // 상한 초과 체크
    if (willBeReceived > upperLimit) {
      throw new BadRequestException(
        `PO(${lot.poNo}) 수량 초과: 주문수량 ${orderQty}, ` +
        `허용범위 ${toleranceRate}%(${lowerLimit.toFixed(0)}~${upperLimit.toFixed(0)}), ` +
        `입고예정 ${willBeReceived} (기입고 ${alreadyReceived} + 이번입고 ${receiveQty})`
      );
    }

    // 하한 미달 경고 (선택사항 - 현재는 허용)
    // if (willBeReceived < lowerLimit) {
    //   console.warn(`PO(${lot.poNo}) 수량 미달 경고: ${willBeReceived} < ${lowerLimit}`);
    // }
  }

  /** 일괄/분할 입고 처리 */
  async createBulkReceive(dto: CreateBulkReceiveDto, company?: string, plant?: string) {
    // LOT 검증
    for (const item of dto.items) {
      const receiveWarehouseCode = item.warehouseId ?? item.warehouseCode;
      if (!receiveWarehouseCode) {
        throw new BadRequestException(`입고 창고를 선택해야 합니다. LOT: ${item.matUid}`);
      }
      const lot = await this.matLotRepository.findOne({
        where: { matUid: item.matUid, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      });
      if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${item.matUid}`);
      this.assertSameTenant('입고 대상 LOT', lot, company, plant);
      // 입고 가능: IQC 합격(PASS) 또는 특채(FAIL + SPECIAL_ACCEPT_YN='Y')
      const isConcession = lot.iqcStatus === 'FAIL' && lot.specialAcceptYn === 'Y';
      if (lot.iqcStatus !== 'PASS' && !isConcession) {
        throw new BadRequestException(`IQC 합격 또는 특채 승인되지 않은 LOT입니다: ${lot.matUid}`);
      }
      // 기입고수량 확인
      const receivedAgg = await this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.qty)', 'sumQty')
        .where('tx.matUid = :matUid', { matUid: item.matUid })
        .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere(company ? 'tx.company = :company' : '1=1', { company })
        .andWhere(plant ? 'tx.plant = :plant' : '1=1', { plant })
        .getRawOne();

      const receivedQty = parseInt(receivedAgg?.sumQty) || 0;
      const remaining = lot.initQty - receivedQty;
      if (item.qty > remaining) {
        throw new BadRequestException(
          `입고수량(${item.qty})이 잔량(${remaining})을 초과합니다. LOT: ${lot.matUid}`,
        );
      }

      // PO 오차율 체크 추가
      await this.checkPoTolerance(lot, item.qty);
    }

    return this.tx.run(async (queryRunner) => {
      const results = [];
      // 같은 배치의 모든 아이템에 동일한 receiveNo 부여
      const receiveNo = await this.numbering.nextInTx(queryRunner, 'RECEIVE');
      let seqCounter = 1;

      for (const item of dto.items) {
        const receiveWarehouseCode = item.warehouseId ?? item.warehouseCode;
        if (!receiveWarehouseCode) {
          throw new BadRequestException(`입고 창고를 선택해야 합니다. LOT: ${item.matUid}`);
        }
        const transNo = await this.numbering.nextInTx(queryRunner, 'STOCK_TX');

        const lot = await queryRunner.manager.findOne(MatLot, {
          where: { matUid: item.matUid, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        });
        if (!lot) continue;
        this.assertSameTenant('입고 대상 LOT', lot, company, plant);

        // 0. MAT_ARRIVALS에서 입하 창고 조회 (LOT의 arrivalNo FK 기준)
        let arrivalRecord: MatArrival | null = null;
        if (lot.arrivalNo) {
          arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
            where: {
              arrivalNo: lot.arrivalNo,
              seq: lot.arrivalSeq ?? 1,
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
          });
        } else {
          // arrivalNo 없는 레거시 LOT — 기존 로직
          arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
            where: {
              itemCode: lot.itemCode,
              status: 'DONE',
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
            order: { arrivalDate: 'DESC' },
          });
        }
        if (arrivalRecord) {
          this.assertSameTenant('입고 대상 입하건', arrivalRecord, company, plant);
        }
        const arrivalWarehouseCode = arrivalRecord?.warehouseCode || null;

        // 출고원천 창고 결정
        // - 일반(PASS): 입하 창고에 LOT 재고가 있으므로 입하 창고에서 차감
        // - 특채(FAIL+특채승인): IQC 불합격 시 불용창고로 이동된 상태이므로,
        //   실제 재고가 남아있는 창고(불용창고)에서 차감해야 음수재고가 발생하지 않는다.
        const isConcession = lot.iqcStatus === 'FAIL' && lot.specialAcceptYn === 'Y';
        let sourceWarehouseCode = arrivalWarehouseCode;
        if (isConcession) {
          const stockRow = await queryRunner.manager.findOne(MatStock, {
            where: {
              matUid: item.matUid,
              itemCode: lot.itemCode,
              qty: MoreThan(0),
              ...(company ? { company } : {}),
              ...(plant ? { plant } : {}),
            },
            order: { qty: 'DESC' },
          });
          sourceWarehouseCode = stockRow?.warehouseCode ?? arrivalWarehouseCode;
        }

        // 1-1. 제조일자 수정 시 LOT 업데이트 + 유효기한 재계산
        if (item.manufactureDate) {
          const lotTenantWhere = this.tenantWhere(lot.company, lot.plant);
          const part = await this.itemMasterRepository.findOne({ where: { itemCode: lot.itemCode, ...lotTenantWhere } });
          const mfgDate = parseDateStart(item.manufactureDate)!;
          let expDate: Date | null = null;
          if (part?.expiryDate && part.expiryDate > 0) {
            expDate = new Date(mfgDate);
            expDate.setDate(expDate.getDate() + part.expiryDate);
          }
          await queryRunner.manager.update(MatLot, { matUid: lot.matUid, ...lotTenantWhere }, {
            manufactureDate: mfgDate,
            expireDate: expDate,
          });
        }

        // 1. MatReceiving 생성 (입고 전용 테이블)
        const currentSeq = seqCounter++;
        const receiving = queryRunner.manager.create(MatReceiving, {
          receiveNo,
          seq: currentSeq,
          matUid: item.matUid,
          itemCode: lot.itemCode,
          qty: item.qty,
          warehouseCode: receiveWarehouseCode,
          vendorBarcode: item.vendorBarcode?.trim() || null,
          workerId: dto.workerId,
          remark: item.remark,
          status: 'DONE',
          company: lot.company,
          plant: lot.plant,
          arrivalNo: lot.arrivalNo,
          arrivalSeq: lot.arrivalSeq,
        });
        await queryRunner.manager.save(receiving);

        // 2. StockTransaction(RECEIVE) 생성 (수불원장 - 창고 이동 기록)
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: 'RECEIVE',
          fromWarehouseId: sourceWarehouseCode,
          toWarehouseId: receiveWarehouseCode,
          itemCode: lot.itemCode,
          matUid: item.matUid,
          qty: item.qty,
          remark: isConcession ? (item.remark ? `${item.remark} (특채입고)` : '특채입고') : item.remark,
          workerId: dto.workerId,
          refType: isConcession ? 'RECEIVE_CONCESSION' : 'RECEIVE',
          refId: `${receiving.receiveNo}-${receiving.seq}`,
          account: 'PROD', // 정상입고 기본 양산계정
          company: lot.company,
          plant: lot.plant,
        });

        const savedTx = await queryRunner.manager.save(stockTx);

        // 3. 출고원천 차감
        //    일반: 입하재고 / 특채: 불용창고 등 실제 창고재고
        if (isConcession && sourceWarehouseCode) {
          await this.upsertStock(queryRunner.manager, sourceWarehouseCode, lot.itemCode, item.matUid, -item.qty, lot.company, lot.plant);
        } else {
          await this.decreaseArrivalStock(queryRunner.manager, item.matUid, lot.itemCode, item.qty, lot.company, lot.plant);
        }

        // 4. 입고 창고에 LOT 단위(matUid) 재고 증가 (+ 적재 로케이션)
        //    수동 지정(item.locationCode) 우선, 미지정 시 품목마스터 STORAGE_LOCATION 자동 적용
        let receiveLocationCode = item.locationCode?.trim() || null;
        if (!receiveLocationCode) {
          const locPart = await this.itemMasterRepository.findOne({
            where: { itemCode: lot.itemCode, ...this.tenantWhere(lot.company, lot.plant) },
          });
          receiveLocationCode = locPart?.storageLocation?.trim() || null;
        }
        await this.upsertStock(queryRunner.manager, receiveWarehouseCode, lot.itemCode, item.matUid, item.qty, lot.company, lot.plant, receiveLocationCode);

        results.push({ ...savedTx, receiveNo });
      }

      return results;
    });
  }

  /** 입고 이력 조회 (MAT_RECEIVINGS 기반) */
  async findAll(query: ReceivingQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate, matUid } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.matReceivingRepository.createQueryBuilder('r')
      .where('r.status = :status', { status: 'DONE' });

    if (company) queryBuilder.andWhere('r.company = :company', { company });
    if (plant) queryBuilder.andWhere('r.plant = :plant', { plant });

    if (fromDate) {
      queryBuilder.andWhere("r.receiveDate >= TO_DATE(:fromDate, 'YYYY-MM-DD')", { fromDate });
    }
    if (toDate) {
      queryBuilder.andWhere("r.receiveDate < TO_DATE(:toDate, 'YYYY-MM-DD') + 1", { toDate });
    }

    if (matUid) {
      queryBuilder.andWhere('r.matUid LIKE :matUid', { matUid: `%${matUid}%` });
    }

    if (search) {
      queryBuilder.andWhere(
        '(r.receiveNo LIKE :search OR r.itemCode IN (SELECT item_code FROM item_masters WHERE item_code LIKE :search OR item_name LIKE :search))',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('r.receiveDate', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    // part, lot, warehouse 정보 조회
    const itemCodes = data.map((item) => item.itemCode).filter(Boolean);
    const matUids = data.map((item) => item.matUid).filter(Boolean);
    const warehouseCodes = data.map((item) => item.warehouseCode).filter(Boolean);
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };

    const [parts, lots, warehouses] = await Promise.all([
      itemCodes.length > 0 ? this.itemMasterRepository.find({ where: { itemCode: In(itemCodes), ...tenantWhere } }) : Promise.resolve([]),
      matUids.length > 0 ? this.matLotRepository.find({ where: { matUid: In(matUids), ...tenantWhere } }) : Promise.resolve([] as MatLot[]),
      warehouseCodes.length > 0 ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes), ...tenantWhere } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // 제조사명/공급사명 해소 (PARTNER_CODE → PARTNER_NAME, 한 번에 IN 절 조회)
    // - 제조사: MAT_LOTS.MFG_PARTNER_CODE
    // - 공급사: MAT_LOTS.VENDOR
    const partnerCodes = [
      ...new Set(
        lots
          .flatMap((l) => [l.mfgPartnerCode, l.vendor])
          .filter(Boolean) as string[],
      ),
    ];
    const partners = partnerCodes.length > 0
      ? await this.partnerMasterRepository.find({ where: { partnerCode: In(partnerCodes), ...tenantWhere } })
      : [];
    const partnerMap = new Map(partners.map((p) => [p.partnerCode, p.partnerName]));

    // 프론트엔드가 기대하는 중첩 객체 형태로 반환
    const enrichedData = data.map((item) => {
      const part = partMap.get(item.itemCode);
      const lot = item.matUid ? lotMap.get(item.matUid) : null;
      const warehouse = item.warehouseCode ? warehouseMap.get(item.warehouseCode) : null;
      const isConcession = lot?.iqcStatus === 'FAIL' && lot?.specialAcceptYn === 'Y';

      return {
        receiveNo: item.receiveNo,
        seq: item.seq,
        transNo: item.receiveNo,
        transDate: item.receiveDate,
        qty: item.qty,
        status: item.status,
        remark: item.remark,
        part: part ? { itemCode: part.itemCode, itemName: part.itemName, unit: part.unit } : null,
        lot: lot ? {
          matUid: lot.matUid,
          poNo: lot.poNo,
          iqcStatus: lot.iqcStatus,
          specialAcceptYn: lot.specialAcceptYn,
        } : null,
        isConcession,
        specialAcceptYn: lot?.specialAcceptYn ?? 'N',
        toWarehouse: warehouse ? { warehouseName: warehouse.warehouseName } : null,
        // 공급처(LOT 입고 거래처)
        vendor: lot?.vendor ?? null,
        // 공급사명(VENDOR 코드 → PARTNER_NAME)
        vendorName: lot?.vendor ? (partnerMap.get(lot.vendor) ?? lot.vendor) : null,
        // 제조사(MFG 파트너명)
        manufacturer: lot?.mfgPartnerCode ? (partnerMap.get(lot.mfgPartnerCode) ?? lot.mfgPartnerCode) : null,
        // 양산/MRO 구분: 소모품(CONSUMABLE)=MRO, 그 외=양산(PROD)
        materialClass: part?.itemType === 'CONSUMABLE' ? 'MRO' : 'PROD',
      };
    });

    return { data: enrichedData, total, page, limit };
  }

  /** 입고 통계 */
  async getStats(company?: string, plant?: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 입고 대기 LOT 수 (IQC PASS인데 미입고, initQty > 0 조건으로 유효 LOT 필터)
    const validLots = await this.matLotRepository.createQueryBuilder('lot')
      .select(['lot.matUid', 'lot.initQty'])
      .where('lot.iqcStatus = :iqcStatus', { iqcStatus: 'PASS' })
      .andWhere('lot.status = :status', { status: 'NORMAL' })
      .andWhere('lot.initQty > 0')
      .andWhere(company ? 'lot.company = :company' : '1=1', { company })
      .andWhere(plant ? 'lot.plant = :plant' : '1=1', { plant })
      .getMany();
    const matUids = validLots.map((l) => l.matUid);

    let pendingLots: typeof validLots = [];
    let receivedMap = new Map<string, number>();

    if (matUids.length > 0) {
      const receivedAgg = await this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('tx.matUid', 'matUid')
        .addSelect('SUM(tx.qty)', 'sumQty')
        .where('tx.matUid IN (:...matUids)', { matUids })
        .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere(company ? 'tx.company = :company' : '1=1', { company })
        .andWhere(plant ? 'tx.plant = :plant' : '1=1', { plant })
        .groupBy('tx.matUid')
        .getRawMany();

      receivedMap = new Map(receivedAgg.map((r) => [r.matUid, parseInt(r.sumQty) || 0]));
      pendingLots = validLots.filter((l) => {
        const received = receivedMap.get(l.matUid) || 0;
        return received < l.initQty;
      });
    }

    const [todayCount, todayQtyResult] = await Promise.all([
      this.stockTransactionRepository.count({
        where: {
          transType: 'RECEIVE',
          status: 'DONE',
          transDate: Between(todayStart, todayEnd),
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
      }),
      this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.qty)', 'sumQty')
        .where('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere('tx.transDate BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
        .andWhere(company ? 'tx.company = :company' : '1=1', { company })
        .andWhere(plant ? 'tx.plant = :plant' : '1=1', { plant })
        .getRawOne(),
    ]);

    return {
      pendingCount: pendingLots.length,
      pendingQty: pendingLots.reduce((sum, l) => sum + l.initQty - (receivedMap.get(l.matUid) || 0), 0),
      todayReceivedCount: todayCount,
      todayReceivedQty: parseInt(todayQtyResult?.sumQty) || 0,
    };
  }

  /**
   * 자동입고 처리 - 라벨 최초 발행 시 기본창고로 자동 입고
   *
   * 로직:
   * 1. IQC_AUTO_RECEIVE 설정 확인
   * 2. 각 LOT의 기입고 여부 확인 (재발행 판별)
   * 3. 기본 창고(isDefault='Y') 조회
   * 4. 미입고 LOT만 createBulkReceive()로 입고 처리
   */
  async autoReceive(matUids: string[], workerId?: string, company?: string, plant?: string) {
    // 1. 설정 확인
    const isAutoEnabled = await this.sysConfigService.isEnabled('IQC_AUTO_RECEIVE');
    if (!isAutoEnabled) {
      return { autoReceiveEnabled: false, received: [], skipped: matUids };
    }

    // 2. 기본 창고 조회
    const defaultWarehouse = await this.warehouseRepository.findOne({
      where: { isDefault: 'Y', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!defaultWarehouse) {
      return {
        autoReceiveEnabled: true,
        received: [],
        skipped: matUids,
        error: '기본 창고가 설정되지 않았습니다.',
      };
    }

    // 3. N+1 방지: 3개 쿼리를 일괄 배치 처리
    const [existingReceivings, lots, receivedAgg] = await Promise.all([
      // 이미 입고된 LOT 조회
      this.matReceivingRepository.find({
        where: { matUid: In(matUids), status: 'DONE', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        select: ['matUid'],
      }),
      // LOT 정보 일괄 조회
      this.matLotRepository.find({
        where: { matUid: In(matUids), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      }),
      // 기입고수량 일괄 집계
      this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('tx.matUid', 'matUid')
        .addSelect('SUM(tx.qty)', 'sumQty')
        .where('tx.matUid IN (:...matUids)', { matUids })
        .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere(company ? 'tx.company = :company' : '1=1', { company })
        .andWhere(plant ? 'tx.plant = :plant' : '1=1', { plant })
        .groupBy('tx.matUid')
        .getRawMany(),
    ]);

    const alreadyReceivedSet = new Set(existingReceivings.map((r) => r.matUid));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));
    const receivedMap = new Map(receivedAgg.map((r) => [r.matUid, parseInt(r.sumQty) || 0]));

    const skipped: string[] = [];
    const receiveItems: { matUid: string; qty: number; warehouseId: string }[] = [];

    for (const matUid of matUids) {
      if (alreadyReceivedSet.has(matUid)) {
        skipped.push(matUid);
        continue;
      }
      const lot = lotMap.get(matUid);
      if (!lot || lot.iqcStatus !== 'PASS') {
        skipped.push(matUid);
        continue;
      }
      const received = receivedMap.get(matUid) || 0;
      const remaining = lot.initQty - received;
      if (remaining <= 0) {
        skipped.push(matUid);
        continue;
      }
      receiveItems.push({ matUid, qty: remaining, warehouseId: defaultWarehouse.warehouseCode });
    }

    // 4. 미입고 건이 있으면 일괄 입고
    if (receiveItems.length > 0) {
      await this.createBulkReceive({ items: receiveItems, workerId }, company, plant);
    }

    return {
      autoReceiveEnabled: true,
      received: receiveItems.map((i) => i.matUid),
      skipped,
      warehouseCode: defaultWarehouse.warehouseCode,
      warehouseName: defaultWarehouse.warehouseName,
    };
  }

  /** MatStock upsert (locationCode 제공 시 적재 로케이션 갱신) */
  private async upsertStock(manager: EntityManager, warehouseCode: string, itemCode: string, matUid: string | null, qtyDelta: number, company?: string, plant?: string, locationCode?: string | null) {
    const existing = await manager.findOne(MatStock, {
      where: { warehouseCode, itemCode, matUid: matUid || null, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });

    if (existing) {
      const newQty = existing.qty + qtyDelta;
      await manager.update(MatStock,
        {
          warehouseCode: existing.warehouseCode,
          itemCode: existing.itemCode,
          matUid: existing.matUid,
          ...(company ? { company } : {}),
          ...(plant ? { plant } : {}),
        },
        { qty: newQty, availableQty: Math.max(0, newQty - existing.reservedQty), ...(locationCode ? { locationCode } : {}) },
      );
    } else if (qtyDelta > 0) {
      const newStock = manager.create(MatStock, {
        warehouseCode,
        itemCode,
        matUid,
        qty: qtyDelta,
        availableQty: qtyDelta,
        ...(locationCode ? { locationCode } : {}),
        company,
        plant,
      });
      await manager.save(newStock);
    }
  }

  private async decreaseArrivalStock(
    manager: EntityManager,
    matUid: string,
    itemCode: string,
    qty: number,
    company?: string | null,
    plant?: string | null,
  ) {
    const stock = await manager.findOne(MatArrivalStock, {
      where: {
        matUid,
        itemCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!stock) {
      throw new BadRequestException(`입하재고를 찾을 수 없습니다. LOT: ${matUid}`);
    }
    if (stock.availableQty < qty || stock.qty < qty) {
      throw new BadRequestException(`입하재고가 부족합니다. LOT: ${matUid}, 요청=${qty}, 입하재고=${stock.availableQty}`);
    }

    const newQty = stock.qty - qty;
    await manager.update(MatArrivalStock, {
      company: stock.company,
      plant: stock.plant,
      matUid: stock.matUid,
    }, {
      qty: newQty,
      availableQty: Math.max(0, stock.availableQty - qty),
      status: newQty > 0 ? 'AVAILABLE' : 'DEPLETED',
    });
  }
}
