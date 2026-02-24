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
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, DataSource } from 'typeorm';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { MatReceiving } from '../../../entities/mat-receiving.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { CreateBulkReceiveDto, ReceivingQueryDto } from '../dto/receiving.dto';
import { NumRuleService } from '../../num-rule/num-rule.service';
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
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
    private readonly sysConfigService: SysConfigService,
  ) {}

  /** 입고 가능 LOT 목록 (IQC 합격 + 미입고/부분입고) */
  async findReceivable(company?: string, plant?: string) {
    // IQC 합격된 LOT 조회 (currentQty > 0 조건을 DB 레벨에서 처리)
    const qb = this.matLotRepository.createQueryBuilder('lot')
      .where('lot.iqcStatus = :iqcStatus', { iqcStatus: 'PASS' })
      .andWhere('lot.status IN (:...statuses)', { statuses: ['NORMAL', 'HOLD'] })
      .andWhere('lot.currentQty > 0');

    if (company) qb.andWhere('lot.company = :company', { company });
    if (plant) qb.andWhere('lot.plant = :plant', { plant });

    const validLots = await qb.orderBy('lot.createdAt', 'DESC').getMany();
    const lotIds = validLots.map((l) => l.id);

    if (lotIds.length === 0) {
      return [];
    }

    // 각 LOT의 기입고수량 계산 (RECEIVE 트랜잭션 합계)
    const receiveTxs = await this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('tx.lotId', 'lotId')
      .addSelect('SUM(tx.qty)', 'sumQty')
      .where('tx.lotId IN (:...lotIds)', { lotIds })
      .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
      .andWhere('tx.status = :status', { status: 'DONE' })
      .groupBy('tx.lotId')
      .getRawMany();

    const receivedMap = new Map<string, number>();
    for (const tx of receiveTxs) {
      if (tx.lotId) receivedMap.set(tx.lotId, parseInt(tx.sumQty) || 0);
    }

    // MAT_ARRIVALS에서 입하 창고 정보 가져오기
    const arrivalRecords = await this.matArrivalRepository.find({
      where: {
        lotId: In(lotIds),
        status: 'DONE',
      },
      select: ['lotId', 'warehouseCode'],
    });

    const arrivalWhMap = new Map<string, string>();
    for (const arr of arrivalRecords) {
      if (arr.lotId) arrivalWhMap.set(arr.lotId, arr.warehouseCode);
    }

    // 창고 정보 조회 (warehouseCode 기준)
    const warehouseCodes = [...new Set(arrivalWhMap.values())].filter(Boolean);
    const warehouseIds = [] as string[]; // 호환용
    const warehouses = warehouseCodes.length > 0
      ? await this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes) } })
      : [];
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // part 정보 조회
    const partIds = validLots.map((lot) => lot.partId).filter(Boolean);
    const parts = partIds.length > 0
      ? await this.partMasterRepository.find({ where: { id: In(partIds) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.id, p]));

    return validLots
      .map((lot) => {
        const receivedQty = receivedMap.get(lot.id) || 0;
        const remainingQty = lot.initQty - receivedQty;
        const arrivalWhCode = arrivalWhMap.get(lot.id);
        const arrivalWarehouse = arrivalWhCode ? warehouseMap.get(arrivalWhCode) : null;
        const part = partMap.get(lot.partId);

        return {
          ...lot,
          receivedQty,
          remainingQty,
          arrivalWarehouse: arrivalWarehouse || null,
          partCode: part?.partCode,
          partName: part?.partName,
          unit: part?.unit,
          expiryDays: part?.expiryDate || 0,
          arrivalWarehouseCode: arrivalWarehouse?.warehouseCode,
          arrivalWarehouseName: arrivalWarehouse?.warehouseName,
        };
      })
      .filter((lot) => lot.remainingQty > 0);
  }

  /** 
   * PO 수량 오차율 체크
   * - LOT의 PO 번호를 기준으로 주문 수량 대비 입고 수량이 오차율 내인지 확인
   * - 초과 시 BadRequestException 발생
   */
  private async checkPoTolerance(lot: MatLot, receiveQty: number): Promise<void> {
    if (!lot.poNo) return; // PO 번호가 없으면 체크 불필요

    // PO 조회 (PO 번호로)
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo: lot.poNo },
    });
    if (!po) return; // PO 정보 없으면 체크 불필요

    // PO 품목 조회
    const poItem = await this.purchaseOrderItemRepository.findOne({
      where: { poId: po.id, partId: lot.partId },
    });
    if (!poItem) return; // PO 품목 정보 없으면 체크 불필요

    // 품목의 오차율 조회
    const part = await this.partMasterRepository.findOne({
      where: { id: lot.partId },
      select: ['id', 'toleranceRate'],
    });
    const toleranceRate = part?.toleranceRate ?? 5.0; // 기본값 5%

    // 해당 PO의 기 입고 수량 조회 (동일 품목 기준)
    const receivedAgg = await this.stockTransactionRepository
      .createQueryBuilder('tx')
      .select('SUM(tx.qty)', 'sumQty')
      .where('tx.transType = :transType', { transType: 'RECEIVE' })
      .andWhere('tx.status = :status', { status: 'DONE' })
      .andWhere('tx.partId = :partId', { partId: lot.partId })
      .andWhere(
        `tx.lotId IN (
          SELECT id FROM mat_lots WHERE po_no = :poNo
        )`,
        { poNo: lot.poNo }
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
  async createBulkReceive(dto: CreateBulkReceiveDto) {
    // LOT 검증
    for (const item of dto.items) {
      const lot = await this.matLotRepository.findOne({
        where: { id: item.lotId },
      });
      if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${item.lotId}`);
      if (lot.iqcStatus !== 'PASS') throw new BadRequestException(`IQC 합격되지 않은 LOT입니다: ${lot.lotNo}`);

      // 기입고수량 확인
      const receivedAgg = await this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.qty)', 'sumQty')
        .where('tx.lotId = :lotId', { lotId: item.lotId })
        .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .getRawOne();

      const receivedQty = parseInt(receivedAgg?.sumQty) || 0;
      const remaining = lot.initQty - receivedQty;
      if (item.qty > remaining) {
        throw new BadRequestException(
          `입고수량(${item.qty})이 잔량(${remaining})을 초과합니다. LOT: ${lot.lotNo}`,
        );
      }

      // PO 오차율 체크 추가
      await this.checkPoTolerance(lot, item.qty);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];
      // 같은 배치의 모든 아이템에 동일한 receiveNo 부여
      const receiveNo = await this.numRuleService.nextNumberInTx(queryRunner, 'RECEIVE');

      for (const item of dto.items) {
        const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');

        const lot = await queryRunner.manager.findOne(MatLot, { where: { id: item.lotId } });
        if (!lot) continue;

        // 0. MAT_ARRIVALS에서 입하 창고 조회
        const arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
          where: { lotId: item.lotId, status: 'DONE' },
          order: { arrivalDate: 'DESC' },
        });
        const arrivalWarehouseCode = arrivalRecord?.warehouseCode || null;

        // 1-1. 제조일자 수정 시 LOT 업데이트 + 유효기한 재계산
        if (item.manufactureDate) {
          const part = await this.partMasterRepository.findOne({ where: { id: lot.partId } });
          const mfgDate = new Date(item.manufactureDate);
          let expDate: Date | null = null;
          if (part?.expiryDate && part.expiryDate > 0) {
            expDate = new Date(mfgDate);
            expDate.setDate(expDate.getDate() + part.expiryDate);
          }
          await queryRunner.manager.update(MatLot, lot.id, {
            manufactureDate: mfgDate,
            expireDate: expDate,
          });
        }

        // 1. MatReceiving 생성 (입고 전용 테이블)
        const receiving = queryRunner.manager.create(MatReceiving, {
          receiveNo,
          lotId: item.lotId,
          partId: lot.partId,
          qty: item.qty,
          warehouseCode: item.warehouseId,
          workerId: dto.workerId,
          remark: item.remark,
          status: 'DONE',
        });
        await queryRunner.manager.save(receiving);

        // 2. StockTransaction(RECEIVE) 생성 (수불원장 - 창고 이동 기록)
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: 'RECEIVE',
          fromWarehouseId: arrivalWarehouseCode,
          toWarehouseId: item.warehouseId,
          partId: lot.partId,
          lotId: item.lotId,
          qty: item.qty,
          remark: item.remark,
          workerId: dto.workerId,
          refType: 'RECEIVE',
          refId: receiving.id,
        });

        const savedTx = await queryRunner.manager.save(stockTx);

        // 3. 입하 창고 재고 차감 (입하 창고 ≠ 입고 창고인 경우만)
        if (arrivalWarehouseCode && arrivalWarehouseCode !== item.warehouseId) {
          await this.upsertStock(queryRunner.manager, arrivalWarehouseCode, lot.partId, item.lotId, -item.qty);
        }

        // 4. 입고 창고 재고 증가
        await this.upsertStock(queryRunner.manager, item.warehouseId, lot.partId, item.lotId, item.qty);

        results.push({ ...savedTx, receiveNo });
      }

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 입고 이력 조회 (MAT_RECEIVINGS 기반) */
  async findAll(query: ReceivingQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.matReceivingRepository.createQueryBuilder('r')
      .where('r.status = :status', { status: 'DONE' });

    if (company) queryBuilder.andWhere('r.company = :company', { company });
    if (plant) queryBuilder.andWhere('r.plant = :plant', { plant });

    if (fromDate && toDate) {
      queryBuilder.andWhere('r.receiveDate BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
      });
    } else if (fromDate) {
      queryBuilder.andWhere('r.receiveDate >= :fromDate', { fromDate: new Date(fromDate) });
    } else if (toDate) {
      queryBuilder.andWhere('r.receiveDate <= :toDate', { toDate: new Date(toDate) });
    }

    if (search) {
      queryBuilder.andWhere(
        '(r.receiveNo LIKE :search OR r.partId IN (SELECT id FROM part_masters WHERE part_code LIKE :search OR part_name LIKE :search))',
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
    const partIds = data.map((item) => item.partId).filter(Boolean);
    const lotIds = data.map((item) => item.lotId).filter(Boolean);
    const warehouseCodes = data.map((item) => item.warehouseCode).filter(Boolean);

    const [parts, lots, warehouses] = await Promise.all([
      partIds.length > 0 ? this.partMasterRepository.find({ where: { id: In(partIds) } }) : Promise.resolve([]),
      lotIds.length > 0 ? this.matLotRepository.find({ where: { id: In(lotIds) } }) : Promise.resolve([] as MatLot[]),
      warehouseCodes.length > 0 ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.id, p]));
    const lotMap = new Map(lots.map((l) => [l.id, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // 프론트엔드가 기대하는 중첩 객체 형태로 반환
    const enrichedData = data.map((item) => {
      const part = partMap.get(item.partId);
      const lot = item.lotId ? lotMap.get(item.lotId) : null;
      const warehouse = item.warehouseCode ? warehouseMap.get(item.warehouseCode) : null;

      return {
        id: item.id,
        receiveNo: item.receiveNo,
        transNo: item.receiveNo,
        transDate: item.receiveDate,
        qty: item.qty,
        status: item.status,
        remark: item.remark,
        part: part ? { partCode: part.partCode, partName: part.partName, unit: part.unit } : null,
        lot: lot ? { lotNo: lot.lotNo, poNo: (lot as any).poNo || null } : null,
        toWarehouse: warehouse ? { warehouseName: warehouse.warehouseName } : null,
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

    // 입고 대기 LOT 수 (IQC PASS인데 미입고, currentQty > 0 조건을 DB 레벨에서 처리)
    const validLots = await this.matLotRepository.createQueryBuilder('lot')
      .select(['lot.id', 'lot.initQty'])
      .where('lot.iqcStatus = :iqcStatus', { iqcStatus: 'PASS' })
      .andWhere('lot.status = :status', { status: 'NORMAL' })
      .andWhere('lot.currentQty > 0')
      .getMany();
    const lotIds = validLots.map((l) => l.id);

    let pendingLots: typeof validLots = [];
    let receivedMap = new Map<string, number>();

    if (lotIds.length > 0) {
      const receivedAgg = await this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('tx.lotId', 'lotId')
        .addSelect('SUM(tx.qty)', 'sumQty')
        .where('tx.lotId IN (:...lotIds)', { lotIds })
        .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .groupBy('tx.lotId')
        .getRawMany();

      receivedMap = new Map(receivedAgg.map((r) => [r.lotId, parseInt(r.sumQty) || 0]));
      pendingLots = validLots.filter((l) => {
        const received = receivedMap.get(l.id) || 0;
        return received < l.initQty;
      });
    }

    const [todayCount, todayQtyResult] = await Promise.all([
      this.stockTransactionRepository.count({
        where: {
          transType: 'RECEIVE',
          status: 'DONE',
          transDate: Between(todayStart, todayEnd),
        },
      }),
      this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.qty)', 'sumQty')
        .where('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere('tx.transDate BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
        .getRawOne(),
    ]);

    return {
      pendingCount: pendingLots.length,
      pendingQty: pendingLots.reduce((sum, l) => sum + l.initQty - (receivedMap.get(l.id) || 0), 0),
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
   * 3. 기본 창고(isDefault=1) 조회
   * 4. 미입고 LOT만 createBulkReceive()로 입고 처리
   */
  async autoReceive(lotIds: string[], workerId?: string) {
    // 1. 설정 확인
    const isAutoEnabled = await this.sysConfigService.isEnabled('IQC_AUTO_RECEIVE');
    if (!isAutoEnabled) {
      return { autoReceiveEnabled: false, received: [], skipped: lotIds };
    }

    // 2. 기본 창고 조회
    const defaultWarehouse = await this.warehouseRepository.findOne({
      where: { isDefault: 1 },
    });
    if (!defaultWarehouse) {
      return {
        autoReceiveEnabled: true,
        received: [],
        skipped: lotIds,
        error: '기본 창고가 설정되지 않았습니다.',
      };
    }

    // 3. 각 LOT별 기입고 여부 확인 (재발행 판별)
    const received: string[] = [];
    const skipped: string[] = [];
    const receiveItems: { lotId: string; qty: number; warehouseId: string }[] = [];

    for (const lotId of lotIds) {
      // MAT_RECEIVINGS에 해당 LOT 기록이 있으면 재발행 → 스킵
      const existingReceiving = await this.matReceivingRepository.findOne({
        where: { lotId, status: 'DONE' },
      });
      if (existingReceiving) {
        skipped.push(lotId);
        continue;
      }

      // LOT 검증 (IQC 합격 + 잔량)
      const lot = await this.matLotRepository.findOne({
        where: { id: lotId },
      });
      if (!lot || lot.iqcStatus !== 'PASS') {
        skipped.push(lotId);
        continue;
      }

      // 기입고수량 확인
      const receivedAgg = await this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.qty)', 'sumQty')
        .where('tx.lotId = :lotId', { lotId })
        .andWhere('tx.transType = :transType', { transType: 'RECEIVE' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .getRawOne();

      const receivedQty = parseInt(receivedAgg?.sumQty) || 0;
      const remaining = lot.initQty - receivedQty;

      if (remaining <= 0) {
        skipped.push(lotId);
        continue;
      }

      receiveItems.push({
        lotId,
        qty: remaining,
        warehouseId: defaultWarehouse.warehouseCode,
      });
    }

    // 4. 미입고 건이 있으면 일괄 입고
    if (receiveItems.length > 0) {
      await this.createBulkReceive({
        items: receiveItems,
        workerId,
      });
      received.push(...receiveItems.map((i) => i.lotId));
    }

    return {
      autoReceiveEnabled: true,
      received,
      skipped,
      warehouseCode: defaultWarehouse.warehouseCode,
      warehouseName: defaultWarehouse.warehouseName,
    };
  }

  /** MatStock upsert */
  private async upsertStock(manager: any, warehouseCode: string, partId: string, lotId: string | null, qtyDelta: number) {
    const existing = await manager.findOne(MatStock, {
      where: { warehouseCode, partId, lotId: lotId || null },
    });

    if (existing) {
      const newQty = existing.qty + qtyDelta;
      await manager.update(MatStock, existing.id, {
        qty: newQty,
        availableQty: Math.max(0, newQty - existing.reservedQty),
      });
    } else if (qtyDelta > 0) {
      const newStock = manager.create(MatStock, {
        warehouseCode,
        partId,
        lotId,
        qty: qtyDelta,
        availableQty: qtyDelta,
      });
      await manager.save(newStock);
    }
  }
}
