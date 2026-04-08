/**
 * @file src/modules/inventory/services/inventory-query.service.ts
 * @description 재고 조회 서비스 — 현재고, 수불이력, LOT 조회
 *
 * 초보자 가이드:
 * - 모든 메서드는 읽기 전용 (수정 없음)
 * - N+1 방지를 위해 In() 배치 조회 사용
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThan } from 'typeorm';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { StockQueryDto, TransactionQueryDto } from '../dto/inventory.dto';

@Injectable()
export class InventoryQueryService {
  constructor(
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(MatStock)
    private readonly stockRepository: Repository<MatStock>,
    @InjectRepository(MatLot)
    private readonly lotRepository: Repository<MatLot>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  /**
   * 현재고 조회
   * @returns 평면화된 재고 데이터 (중첩 객체 → 평면 필드)
   */
  async getStock(query: StockQueryDto, company?: string, plant?: string) {
    const where: any = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.warehouseCode) where.warehouseCode = query.warehouseCode;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.matUid) where.matUid = query.matUid;

    const stocks = await this.stockRepository.find({
      where,
      select: ['warehouseCode', 'itemCode', 'matUid', 'qty', 'reservedQty', 'availableQty'],
      order: { warehouseCode: 'ASC', itemCode: 'ASC' },
    });

    // 0수량 제외
    let filtered = query.includeZero ? stocks : stocks.filter((s) => s.qty > 0);

    if (filtered.length === 0) return [];

    // 관련 데이터 일괄 조회
    const whCodes = [...new Set(filtered.map((s) => s.warehouseCode).filter(Boolean))];
    const itemCodes = [...new Set(filtered.map((s) => s.itemCode).filter(Boolean))];
    const matUids = [...new Set(filtered.map((s) => s.matUid).filter(Boolean))];

    const warehouses = whCodes.length > 0 ? await this.warehouseRepository.find({
      where: { warehouseCode: In(whCodes) },
      select: ['warehouseCode', 'warehouseName', 'warehouseType'],
    }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({
      where: { itemCode: In(itemCodes) },
      select: ['itemCode', 'itemName', 'itemType', 'unit'],
    }) : [];
    const lots = matUids.length > 0 ? await this.lotRepository.find({
      where: { matUid: In(matUids as string[]) },
      select: ['matUid', 'status'],
    }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w] as const));
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));
    const lotMap = new Map(lots.map((l) => [l.matUid, l] as const));

    // warehouseType/itemType 필터링
    if (query.warehouseType) {
      filtered = filtered.filter((s) => whMap.get(s.warehouseCode)?.warehouseType === query.warehouseType);
    }
    if (query.itemType) {
      filtered = filtered.filter((s) => partMap.get(s.itemCode)?.itemType === query.itemType);
    }

    return filtered.map((s) => {
      const wh = whMap.get(s.warehouseCode);
      const part = partMap.get(s.itemCode);
      const lot = s.matUid ? lotMap.get(s.matUid) : null;
      return {
        warehouseId: s.warehouseCode,
        itemCode: s.itemCode,
        matUid: s.matUid,
        qty: s.qty,
        reservedQty: s.reservedQty,
        availableQty: s.availableQty,
        itemName: part?.itemName || null,
        itemType: part?.itemType || null,
        unit: part?.unit || null,
        warehouseCode: wh?.warehouseCode || null,
        warehouseName: wh?.warehouseName || null,
        warehouseType: wh?.warehouseType || null,
        lotStatus: lot?.status || null,
      };
    });
  }

  /**
   * 수불 이력 조회 (원자재 STOCK_TRANSACTIONS)
   */
  async getTransactions(query: TransactionQueryDto, company?: string, plant?: string) {
    const where: any = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.matUid) where.matUid = query.matUid;
    if (query.transType) where.transType = query.transType;
    if (query.refType) where.refType = query.refType;
    if (query.refId) where.refId = query.refId;

    const qb = this.stockTransactionRepository.createQueryBuilder('trans')
      .where(where);

    if (query.warehouseCode) {
      qb.andWhere(
        '(trans.fromWarehouseId = :warehouseId OR trans.toWarehouseId = :warehouseId)',
        { warehouseId: query.warehouseCode },
      );
    }
    if (query.dateFrom) {
      qb.andWhere('trans.transDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      const endOfDay = new Date(query.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      qb.andWhere('trans.transDate <= :dateTo', { dateTo: endOfDay });
    }

    const transactions = await qb
      .orderBy('trans.transDate', 'DESC')
      .take(query.limit || 100)
      .skip(query.offset || 0)
      .getMany();

    if (transactions.length === 0) return [];

    // 관련 데이터 일괄 조회
    const whIds = [...new Set(transactions.flatMap((t) => [t.fromWarehouseId, t.toWarehouseId].filter(Boolean)))];
    const itemCodes = [...new Set(transactions.map((t) => t.itemCode).filter(Boolean))];
    const matUids = [...new Set(transactions.map((t) => t.matUid).filter(Boolean))];

    const warehouses = whIds.length > 0 ? await this.warehouseRepository.find({ where: { warehouseCode: In(whIds as string[]) } }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes as string[]) } }) : [];
    const lots = matUids.length > 0 ? await this.lotRepository.find({ where: { matUid: In(matUids as string[]) } }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.matUid, l]));

    return transactions.map((t) => ({
      ...t,
      fromWarehouse: t.fromWarehouseId ? whMap.get(t.fromWarehouseId) || null : null,
      toWarehouse: t.toWarehouseId ? whMap.get(t.toWarehouseId) || null : null,
      part: partMap.get(t.itemCode) || null,
      lot: t.matUid ? lotMap.get(t.matUid) || null : null,
    }));
  }

  /**
   * LOT 목록 조회
   */
  async getLots(query: { itemCode?: string; itemType?: string; status?: string }) {
    const where: any = {};
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.status) where.status = query.status;

    const lots = await this.lotRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

    if (lots.length === 0) return [];

    const itemCodes = [...new Set(lots.map((l) => l.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return lots.map((l) => ({
      ...l,
      part: partMap.get(l.itemCode) || null,
    }));
  }

  /**
   * LOT 상세 조회
   */
  async getLotById(id: string) {
    const lot = await this.lotRepository.findOne({
      where: { matUid: id },
    });

    if (!lot) {
      throw new NotFoundException('LOT을 찾을 수 없습니다.');
    }

    const [part, stocks, transactions] = await Promise.all([
      this.partMasterRepository.findOne({ where: { itemCode: lot.itemCode } }),
      this.stockRepository.find({ where: { matUid: id } }),
      this.stockTransactionRepository.find({
        where: { matUid: id },
        order: { transDate: 'DESC' },
        take: 20,
      }),
    ]);

    // stock에 warehouse 정보 추가
    const whCodes = [...new Set(stocks.map((s) => s.warehouseCode).filter(Boolean))];
    const warehouses = whCodes.length > 0
      ? await this.warehouseRepository.find({ where: { warehouseCode: In(whCodes) } })
      : [];
    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    return {
      ...lot,
      part,
      stocks: stocks.map((s) => ({ ...s, warehouse: whMap.get(s.warehouseCode) || null })),
      transactions,
    };
  }

  /**
   * 트랜잭션 상세 조회 (transNo)
   */
  async getTransactionById(transNo: string) {
    const transaction = await this.stockTransactionRepository.findOne({
      where: { transNo },
    });

    if (!transaction) {
      throw new NotFoundException('트랜잭션을 찾을 수 없습니다.');
    }

    // 관련 데이터 일괄 조회
    const [fromWarehouse, toWarehouse, part, lot, cancelRef, canceledByTrans] = await Promise.all([
      transaction.fromWarehouseId ? this.warehouseRepository.findOne({ where: { warehouseCode: transaction.fromWarehouseId } }) : null,
      transaction.toWarehouseId ? this.warehouseRepository.findOne({ where: { warehouseCode: transaction.toWarehouseId } }) : null,
      this.partMasterRepository.findOne({ where: { itemCode: transaction.itemCode } }),
      transaction.matUid ? this.lotRepository.findOne({ where: { matUid: transaction.matUid } }) : null,
      transaction.cancelRefId ? this.stockTransactionRepository.findOne({ where: { transNo: transaction.cancelRefId } }) : null,
      this.stockTransactionRepository.findOne({ where: { cancelRefId: transNo } }),
    ]);

    return {
      ...transaction,
      fromWarehouse,
      toWarehouse,
      part,
      lot,
      cancelRef,
      canceledByTrans,
    };
  }

  /**
   * 트랜잭션 상세 조회 (alias)
   */
  async getTransaction(id: string) {
    return this.getTransactionById(id);
  }

  /**
   * 재고 집계
   */
  async getStockSummary(query: { warehouseType?: string; itemType?: string }) {
    let stocks = await this.stockRepository.find({
      where: { qty: MoreThan(0) },
      select: ['warehouseCode', 'itemCode', 'qty'],
    });

    if (stocks.length === 0) return [];

    const whCodes = [...new Set(stocks.map((s) => s.warehouseCode).filter(Boolean))];
    const itemCodes = [...new Set(stocks.map((s) => s.itemCode).filter(Boolean))];

    const warehouses = whCodes.length > 0 ? await this.warehouseRepository.find({
      where: { warehouseCode: In(whCodes) },
      select: ['warehouseCode', 'warehouseName', 'warehouseType'],
    }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({
      where: { itemCode: In(itemCodes) },
      select: ['itemCode', 'itemName', 'itemType'],
    }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w] as const));
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    // 타입 필터
    if (query.warehouseType) {
      stocks = stocks.filter((s) => whMap.get(s.warehouseCode)?.warehouseType === query.warehouseType);
    }
    if (query.itemType) {
      stocks = stocks.filter((s) => partMap.get(s.itemCode)?.itemType === query.itemType);
    }

    // 품목별 집계
    const summary: Record<string, { itemCode: string; itemName: string; totalQty: number; warehouses: any[] }> = {};

    for (const stock of stocks) {
      const part = partMap.get(stock.itemCode);
      const wh = whMap.get(stock.warehouseCode);

      if (!summary[stock.itemCode]) {
        summary[stock.itemCode] = {
          itemCode: stock.itemCode,
          itemName: part?.itemName || '',
          totalQty: 0,
          warehouses: [],
        };
      }
      summary[stock.itemCode].totalQty += stock.qty;
      summary[stock.itemCode].warehouses.push({
        warehouseId: stock.warehouseCode,
        warehouseCode: wh?.warehouseCode || '',
        warehouseName: wh?.warehouseName || '',
        qty: stock.qty,
      });
    }

    return Object.values(summary);
  }
}
