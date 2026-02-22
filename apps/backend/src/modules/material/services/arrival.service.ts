/**
 * @file src/modules/material/services/arrival.service.ts
 * @description 입하관리 비즈니스 로직 - PO 기반/수동 입하 및 역분개 취소 (TypeORM)
 *
 * 초보자 가이드:
 * 1. **PO 입하**: PurchaseOrder 기반 분할 입하 (receivedQty 누적, PO status 재계산)
 * 2. **수동 입하**: PO 없이 직접 입하 등록
 * 3. **입하 취소**: 역분개 방식 (원본 CANCELED + 반대 트랜잭션 생성)
 * 4. **Stock upsert**: 입하 시 Stock 테이블 현재고 업데이트
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, Between, DataSource } from 'typeorm';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import {
  CreatePoArrivalDto,
  CreateManualArrivalDto,
  ArrivalQueryDto,
  CancelArrivalDto,
} from '../dto/arrival.dto';

@Injectable()
export class ArrivalService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
  ) {}

  /** 입하 가능 PO 목록 조회 (CONFIRMED/PARTIAL 상태) */
  async findReceivablePOs(company?: string, plant?: string) {
    const where: any = {
      status: In(['CONFIRMED', 'PARTIAL']),
      deletedAt: IsNull(),
    };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const pos = await this.purchaseOrderRepository.find({
      where,
      order: { orderDate: 'DESC' },
    });

    // PO 아이템 조회
    const poIds = pos.map((po) => po.id);
    const items = await this.purchaseOrderItemRepository.find({
      where: { poId: In(poIds) },
    });

    const partIds = items.map((item) => item.partId).filter(Boolean);
    const parts = partIds.length > 0
      ? await this.partMasterRepository.find({ where: { id: In(partIds) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.id, p]));

    // PO별 아이템 그룹화
    const itemsByPoId = new Map<string, typeof items>();
    for (const item of items) {
      if (!itemsByPoId.has(item.poId)) {
        itemsByPoId.set(item.poId, []);
      }
      itemsByPoId.get(item.poId)!.push(item);
    }

    return pos.map((po) => {
      const poItems = itemsByPoId.get(po.id) || [];
      const enrichedItems = poItems.map((item) => ({
        ...item,
        remainingQty: item.orderQty - item.receivedQty,
        partCode: partMap.get(item.partId)?.partCode,
        partName: partMap.get(item.partId)?.partName,
        unit: partMap.get(item.partId)?.unit,
      }));

      return {
        ...po,
        items: enrichedItems,
        totalOrderQty: poItems.reduce((sum, i) => sum + i.orderQty, 0),
        totalReceivedQty: poItems.reduce((sum, i) => sum + i.receivedQty, 0),
        totalRemainingQty: poItems.reduce((sum, i) => sum + (i.orderQty - i.receivedQty), 0),
      };
    });
  }

  /** 특정 PO의 입하 가능 품목 조회 */
  async getPoItems(poId: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { id: poId, deletedAt: IsNull() },
    });

    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${poId}`);

    const items = await this.purchaseOrderItemRepository.find({
      where: { poId },
    });

    const partIds = items.map((item: PurchaseOrderItem) => item.partId).filter(Boolean);
    const parts = partIds.length > 0
      ? await this.partMasterRepository.find({ where: { id: In(partIds) } })
      : [];
    const partMap = new Map(parts.map((p: PartMaster) => [p.id, p]));

    return {
      ...po,
      items: items
        .map((item: PurchaseOrderItem) => ({
          ...item,
          remainingQty: item.orderQty - item.receivedQty,
          partCode: partMap.get(item.partId)?.partCode,
          partName: partMap.get(item.partId)?.partName,
          unit: partMap.get(item.partId)?.unit,
        }))
        .filter((item) => item.remainingQty > 0),
    };
  }

  /** PO 기반 입하 등록 (핵심 트랜잭션) */
  async createPoArrival(dto: CreatePoArrivalDto) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { id: dto.poId, deletedAt: IsNull() },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${dto.poId}`);
    if (!['CONFIRMED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException(`입하 불가 상태입니다: ${po.status}`);
    }

    const poItems = await this.purchaseOrderItemRepository.find({
      where: { poId: dto.poId },
    });

    // 잔량 검증
    for (const item of dto.items) {
      const poItem = poItems.find((pi) => pi.id === item.poItemId);
      if (!poItem) throw new BadRequestException(`PO 품목을 찾을 수 없습니다: ${item.poItemId}`);
      const remaining = poItem.orderQty - poItem.receivedQty;
      if (item.receivedQty > remaining) {
        throw new BadRequestException(
          `입하수량(${item.receivedQty})이 잔량(${remaining})을 초과합니다.`,
        );
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];

      for (const item of dto.items) {
        const transNo = `ARR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
        const lotNo = item.lotNo || `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        // 1. LOT 생성 (제조일자 + 유효기한 자동 계산)
        const part = await this.partMasterRepository.findOne({ where: { id: item.partId } });
        const mfgDate = item.manufactureDate ? new Date(item.manufactureDate) : null;
        let expDate: Date | null = null;
        if (mfgDate && part?.expiryDate && part.expiryDate > 0) {
          expDate = new Date(mfgDate);
          expDate.setDate(expDate.getDate() + part.expiryDate);
        }

        const lot = queryRunner.manager.create(MatLot, {
          lotNo,
          partId: item.partId,
          initQty: item.receivedQty,
          currentQty: item.receivedQty,
          recvDate: new Date(),
          manufactureDate: mfgDate,
          expireDate: expDate,
          poNo: po.poNo,
          vendor: po.partnerName,
        });
        const savedLot = await queryRunner.manager.save(lot);

        // 2. StockTransaction 생성
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: 'MAT_IN',
          toWarehouseId: item.warehouseId,
          partId: item.partId,
          lotId: savedLot.id,
          qty: item.receivedQty,
          remark: item.remark || dto.remark,
          workerId: dto.workerId,
          refType: 'PO',
          refId: item.poItemId,
        });
        const savedTx = await queryRunner.manager.save(stockTx);

        // 3. Stock upsert (현재고 반영)
        await this.upsertStock(queryRunner.manager, item.warehouseId, item.partId, savedLot.id, item.receivedQty);

        // 4. PurchaseOrderItem.receivedQty 증가
        const poItem = poItems.find((pi) => pi.id === item.poItemId);
        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, poItem.id, {
            receivedQty: poItem.receivedQty + item.receivedQty,
          });
        }

        // part, warehouse 정보 조회 (part는 이미 위에서 조회)
        const warehouse = await this.warehouseRepository.findOne({ where: { id: item.warehouseId } });

        results.push({
          ...savedTx,
          partCode: part?.partCode,
          partName: part?.partName,
          partType: part?.partType,
          unit: part?.unit,
          lotNo: savedLot?.lotNo,
          warehouseCode: warehouse?.warehouseCode,
          warehouseName: warehouse?.warehouseName,
        });
      }

      // 5. PO 상태 재계산
      await this.updatePOStatus(queryRunner.manager, dto.poId);

      await queryRunner.commitTransaction();
      return results;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수동 입하 등록 */
  async createManualArrival(dto: CreateManualArrivalDto) {
    const transNo = `ARR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const lotNo = dto.lotNo || `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. LOT 생성 (제조일자 + 유효기한 자동 계산)
      const part = await this.partMasterRepository.findOne({ where: { id: dto.partId } });
      const mfgDate = dto.manufactureDate ? new Date(dto.manufactureDate) : null;
      let expDate: Date | null = null;
      if (mfgDate && part?.expiryDate && part.expiryDate > 0) {
        expDate = new Date(mfgDate);
        expDate.setDate(expDate.getDate() + part.expiryDate);
      }

      const lot = queryRunner.manager.create(MatLot, {
        lotNo,
        partId: dto.partId,
        initQty: dto.qty,
        currentQty: dto.qty,
        recvDate: new Date(),
        manufactureDate: mfgDate,
        expireDate: expDate,
        vendor: dto.vendor,
      });
      const savedLot = await queryRunner.manager.save(lot);

      // 2. StockTransaction 생성
      const stockTx = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'MAT_IN',
        toWarehouseId: dto.warehouseId,
        partId: dto.partId,
        lotId: savedLot.id,
        qty: dto.qty,
        remark: dto.remark,
        workerId: dto.workerId,
        refType: 'MANUAL',
      });
      const savedTx = await queryRunner.manager.save(stockTx);

      // 3. Stock upsert
      await this.upsertStock(queryRunner.manager, dto.warehouseId, dto.partId, savedLot.id, dto.qty);

      // warehouse 정보 조회 (part는 이미 위에서 조회)
      const warehouse = await this.warehouseRepository.findOne({ where: { id: dto.warehouseId } });

      await queryRunner.commitTransaction();

      return {
        ...savedTx,
        partCode: part?.partCode,
        partName: part?.partName,
        partType: part?.partType,
        unit: part?.unit,
        lotNo: savedLot?.lotNo,
        warehouseCode: warehouse?.warehouseCode,
        warehouseName: warehouse?.warehouseName,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 입하 이력 조회 (MAT_IN + MAT_IN_CANCEL) */
  async findAll(query: ArrivalQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, fromDate, toDate, status } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.stockTransactionRepository.createQueryBuilder('tx')
      .where('tx.transType IN (:...transTypes)', { transTypes: ['MAT_IN', 'MAT_IN_CANCEL'] });

    if (company) queryBuilder.andWhere('tx.company = :company', { company });
    if (plant) queryBuilder.andWhere('tx.plant = :plant', { plant });

    if (status) {
      queryBuilder.andWhere('tx.status = :status', { status });
    }

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
      partIds.length > 0 ? this.partMasterRepository.find({ where: { id: In(partIds) } }) : Promise.resolve([]),
      lotIds.length > 0 ? this.matLotRepository.find({ where: { id: In(lotIds) } }) : Promise.resolve([]),
      warehouseIds.length > 0 ? this.warehouseRepository.find({ where: { id: In(warehouseIds) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.id, p]));
    const lotMap = new Map(lots.map((l) => [l.id, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

    const flattenedData = data.map((item) => {
      const part = partMap.get(item.partId);
      const lot = item.lotId ? lotMap.get(item.lotId) : null;
      const warehouse = item.toWarehouseId ? warehouseMap.get(item.toWarehouseId) : null;

      return {
        ...item,
        partCode: part?.partCode,
        partName: part?.partName,
        partType: part?.partType,
        unit: part?.unit,
        lotNo: lot?.lotNo,
        warehouseCode: warehouse?.warehouseCode,
        warehouseName: warehouse?.warehouseName,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  /** 입하 취소 (역분개 트랜잭션) */
  async cancel(dto: CancelArrivalDto) {
    const original = await this.stockTransactionRepository.findOne({
      where: { id: dto.transactionId },
    });

    if (!original) throw new NotFoundException(`트랜잭션을 찾을 수 없습니다: ${dto.transactionId}`);
    if (original.status === 'CANCELED') throw new BadRequestException('이미 취소된 트랜잭션입니다.');
    if (original.transType !== 'MAT_IN') throw new BadRequestException('입하 트랜잭션만 취소할 수 있습니다.');

    const cancelTransNo = `${original.transNo}-C`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 원본 CANCELED 처리
      await queryRunner.manager.update(StockTransaction, dto.transactionId, { status: 'CANCELED' });

      // 2. 역분개 트랜잭션 생성
      const cancelTx = queryRunner.manager.create(StockTransaction, {
        transNo: cancelTransNo,
        transType: 'MAT_IN_CANCEL',
        fromWarehouseId: original.toWarehouseId,
        partId: original.partId,
        lotId: original.lotId,
        qty: -original.qty,
        remark: dto.reason,
        workerId: dto.workerId,
        cancelRefId: original.id,
        refType: 'CANCEL',
      });
      const savedCancelTx = await queryRunner.manager.save(cancelTx);

      // 3. Stock 감소
      if (original.toWarehouseId) {
        await this.upsertStock(
          queryRunner.manager, original.toWarehouseId, original.partId, original.lotId, -original.qty,
        );
      }

      // 4. LOT.currentQty 감소
      if (original.lotId) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { id: original.lotId } });
        if (lot) {
          const newQty = Math.max(0, lot.currentQty - original.qty);
          await queryRunner.manager.update(MatLot, lot.id, {
            currentQty: newQty,
            status: newQty === 0 ? 'DEPLETED' : lot.status,
          });
        }
      }

      // 5. PO receivedQty 감소 + PO status 재계산
      if (original.refType === 'PO' && original.refId) {
        const poItem = await queryRunner.manager.findOne(PurchaseOrderItem, { where: { id: original.refId } });
        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, poItem.id, {
            receivedQty: Math.max(0, poItem.receivedQty - original.qty),
          });
          await this.updatePOStatus(queryRunner.manager, poItem.poId);
        }
      }

      // part, lot, warehouse 정보 조회
      const [part, lot, toWarehouse] = await Promise.all([
        this.partMasterRepository.findOne({ where: { id: original.partId } }),
        original.lotId ? this.matLotRepository.findOne({ where: { id: original.lotId } }) : null,
        original.toWarehouseId ? this.warehouseRepository.findOne({ where: { id: original.toWarehouseId } }) : null,
      ]);

      await queryRunner.commitTransaction();

      return {
        ...savedCancelTx,
        partCode: part?.partCode,
        partName: part?.partName,
        partType: part?.partType,
        unit: part?.unit,
        lotNo: lot?.lotNo,
        warehouseCode: toWarehouse?.warehouseCode,
        warehouseName: toWarehouse?.warehouseName,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 오늘 입하 통계 */
  async getStats(company?: string, plant?: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayCount, todayQtyResult, unrecevedPoCount, totalCount] = await Promise.all([
      this.stockTransactionRepository.count({
        where: { transType: 'MAT_IN', status: 'DONE', transDate: Between(todayStart, todayEnd) },
      }),
      this.stockTransactionRepository
        .createQueryBuilder('tx')
        .select('SUM(tx.qty)', 'sumQty')
        .where('tx.transType = :transType', { transType: 'MAT_IN' })
        .andWhere('tx.status = :status', { status: 'DONE' })
        .andWhere('tx.transDate BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
        .getRawOne(),
      this.purchaseOrderRepository.count({
        where: { status: In(['CONFIRMED', 'PARTIAL']), deletedAt: IsNull() },
      }),
      this.stockTransactionRepository.count({
        where: { transType: 'MAT_IN' },
      }),
    ]);

    return {
      todayCount,
      todayQty: parseInt(todayQtyResult?.sumQty) || 0,
      unrecevedPoCount,
      totalCount,
    };
  }

  /** PO 상태 재계산 */
  private async updatePOStatus(manager: any, poId: string) {
    const poItems = await manager.find(PurchaseOrderItem, {
      where: { poId },
    });

    const allReceived = poItems.every(
      (item: PurchaseOrderItem) => item.receivedQty >= item.orderQty,
    );
    const someReceived = poItems.some(
      (item: PurchaseOrderItem) => item.receivedQty > 0,
    );

    let newStatus: string;
    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'CONFIRMED';
    }

    await manager.update(PurchaseOrder, poId, { status: newStatus });
  }

  /** MatStock upsert (현재고 증감) */
  private async upsertStock(manager: any, warehouseCode: string, partId: string, lotId: string | null, qtyDelta: number) {
    const existing = await manager.findOne(MatStock, {
      where: { warehouseCode, partId, lotId: lotId || null },
    });

    if (existing) {
      const newQty = Math.max(0, existing.qty + qtyDelta);
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
