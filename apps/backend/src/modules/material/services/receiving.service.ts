/**
 * @file src/modules/material/services/receiving.service.ts
 * @description 입고관리 비즈니스 로직 - IQC 합격건 일괄/분할 입고 확정 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **입고 대상**: LOT.iqcStatus='PASS'이고 아직 입고 미완료인 건
 * 2. **입고 완료 판단**: 해당 LOT에 대한 RECEIVE 트랜잭션 합계가 initQty 이상이면 완료
 * 3. **분할 입고**: LOT의 일부 수량만 입고 가능 (잔량 = initQty - 기입고수량)
 * 4. **Stock 반영**: 입고 시 대상 창고에 Stock upsert
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, Between, DataSource } from 'typeorm';
import { Lot } from '../../../entities/lot.entity';
import { Stock } from '../../../entities/stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { CreateBulkReceiveDto, ReceivingQueryDto } from '../dto/receiving.dto';

@Injectable()
export class ReceivingService {
  constructor(
    @InjectRepository(Lot)
    private readonly lotRepository: Repository<Lot>,
    @InjectRepository(Stock)
    private readonly stockRepository: Repository<Stock>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
  ) {}

  /** 입고 가능 LOT 목록 (IQC 합격 + 미입고/부분입고) */
  async findReceivable() {
    // IQC 합격된 LOT 조회
    const lots = await this.lotRepository.find({
      where: {
        iqcStatus: 'PASS',
        status: In(['NORMAL', 'HOLD']),
        deletedAt: IsNull(),
      },
      order: { createdAt: 'DESC' },
    });

    // currentQty > 0 필터링
    const validLots = lots.filter((lot) => lot.currentQty > 0);
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

    // 입하 트랜잭션에서 창고 정보 가져오기
    const arrivalTxs = await this.stockTransactionRepository.find({
      where: {
        lotId: In(lotIds),
        transType: 'MAT_IN',
        status: 'DONE',
      },
      select: ['lotId', 'toWarehouseId'],
    });

    const arrivalWhMap = new Map<string, string | null>();
    for (const tx of arrivalTxs) {
      if (tx.lotId) arrivalWhMap.set(tx.lotId, tx.toWarehouseId);
    }

    // 창고 정보 조회
    const warehouseIds = [...new Set(arrivalWhMap.values())].filter(Boolean) as string[];
    const warehouses = await this.warehouseRepository.findByIds(warehouseIds);
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    // part 정보 조회
    const partIds = validLots.map((lot) => lot.partId).filter(Boolean);
    const parts = await this.partMasterRepository.findByIds(partIds);
    const partMap = new Map(parts.map((p) => [p.id, p]));

    return validLots
      .map((lot) => {
        const receivedQty = receivedMap.get(lot.id) || 0;
        const remainingQty = lot.initQty - receivedQty;
        const warehouseId = arrivalWhMap.get(lot.id);
        const arrivalWarehouse = warehouseId ? warehouseMap.get(warehouseId) : null;
        const part = partMap.get(lot.partId);

        return {
          ...lot,
          receivedQty,
          remainingQty,
          arrivalWarehouse: arrivalWarehouse || null,
          partCode: part?.partCode,
          partName: part?.partName,
          unit: part?.unit,
          arrivalWarehouseCode: arrivalWarehouse?.warehouseCode,
          arrivalWarehouseName: arrivalWarehouse?.warehouseName,
        };
      })
      .filter((lot) => lot.remainingQty > 0);
  }

  /** 일괄/분할 입고 처리 */
  async createBulkReceive(dto: CreateBulkReceiveDto) {
    // LOT 검증
    for (const item of dto.items) {
      const lot = await this.lotRepository.findOne({
        where: { id: item.lotId, deletedAt: IsNull() },
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
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];

      for (const item of dto.items) {
        const transNo = `RCV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

        const lot = await queryRunner.manager.findOne(Lot, { where: { id: item.lotId } });
        if (!lot) continue;

        // 1. StockTransaction(RECEIVE) 생성
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: 'RECEIVE',
          toWarehouseId: item.warehouseId,
          partId: lot.partId,
          lotId: item.lotId,
          qty: item.qty,
          remark: item.remark,
          workerId: dto.workerId,
          refType: 'RECEIVE',
        });

        const savedTx = await queryRunner.manager.save(stockTx);

        // 2. Stock upsert (입고 창고에 반영)
        await this.upsertStock(queryRunner.manager, item.warehouseId, lot.partId, item.lotId, item.qty);

        results.push(savedTx);
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

  /** 입고 이력 조회 */
  async findAll(query: ReceivingQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.stockTransactionRepository.createQueryBuilder('tx')
      .where('tx.transType = :transType', { transType: 'RECEIVE' })
      .andWhere('tx.status = :status', { status: 'DONE' });

    if (fromDate && toDate) {
      queryBuilder.andWhere('tx.transDate BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
      });
    } else if (fromDate) {
      queryBuilder.andWhere('tx.transDate >= :fromDate', { fromDate: new Date(fromDate) });
    } else if (toDate) {
      queryBuilder.andWhere('tx.transDate <= :toDate', { toDate: new Date(toDate) });
    }

    if (search) {
      queryBuilder.andWhere(
        '(tx.transNo LIKE :search OR tx.partId IN (SELECT id FROM part_masters WHERE part_code LIKE :search OR part_name LIKE :search))',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('tx.transDate', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    // part, lot, warehouse 정보 조회
    const partIds = data.map((item) => item.partId).filter(Boolean);
    const lotIds = data.map((item) => item.lotId).filter(Boolean) as string[];
    const warehouseIds = data.map((item) => item.toWarehouseId).filter(Boolean) as string[];

    const [parts, lots, warehouses] = await Promise.all([
      this.partMasterRepository.findByIds(partIds),
      lotIds.length > 0 ? this.lotRepository.findByIds(lotIds) : Promise.resolve([]),
      warehouseIds.length > 0 ? this.warehouseRepository.findByIds(warehouseIds) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.id, p]));
    const lotMap = new Map(lots.map((l) => [l.id, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    // 중첩 객체 평면화
    const flattenedData = data.map((item) => {
      const part = partMap.get(item.partId);
      const lot = item.lotId ? lotMap.get(item.lotId) : null;
      const warehouse = item.toWarehouseId ? warehouseMap.get(item.toWarehouseId) : null;

      return {
        ...item,
        partCode: part?.partCode,
        partName: part?.partName,
        unit: part?.unit,
        lotNo: lot?.lotNo,
        warehouseCode: warehouse?.warehouseCode,
        warehouseName: warehouse?.warehouseName,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  /** 입고 통계 */
  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 입고 대기 LOT 수 (IQC PASS인데 미입고)
    const passedLots = await this.lotRepository.find({
      where: { iqcStatus: 'PASS', status: 'NORMAL', deletedAt: IsNull() },
      select: ['id', 'initQty'],
    });
    const validLots = passedLots.filter((l) => l.currentQty > 0);
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

  /** Stock upsert */
  private async upsertStock(manager: any, warehouseId: string, partId: string, lotId: string | null, qtyDelta: number) {
    const existing = await manager.findOne(Stock, {
      where: { warehouseId, partId, lotId: lotId || null },
    });

    if (existing) {
      const newQty = existing.qty + qtyDelta;
      await manager.update(Stock, existing.id, {
        qty: newQty,
        availableQty: Math.max(0, newQty - existing.reservedQty),
        lastTransAt: new Date(),
      });
    } else if (qtyDelta > 0) {
      const newStock = manager.create(Stock, {
        warehouseId,
        partId,
        lotId,
        qty: qtyDelta,
        availableQty: qtyDelta,
        lastTransAt: new Date(),
      });
      await manager.save(newStock);
    }
  }
}
