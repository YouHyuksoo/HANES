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
import { Repository, In, Between, DataSource } from 'typeorm';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { MatStock } from '../../../entities/mat-stock.entity';
import { MatArrival } from '../../../entities/mat-arrival.entity';
import { StockTransaction } from '../../../entities/stock-transaction.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import {
  CreatePoArrivalDto,
  CreateManualArrivalDto,
  ArrivalQueryDto,
  ArrivalStockQueryDto,
  CancelArrivalDto,
} from '../dto/arrival.dto';
import { NumRuleService } from '../../num-rule/num-rule.service';

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
    @InjectRepository(MatArrival)
    private readonly matArrivalRepository: Repository<MatArrival>,
    @InjectRepository(StockTransaction)
    private readonly stockTransactionRepository: Repository<StockTransaction>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    private readonly dataSource: DataSource,
    private readonly numRuleService: NumRuleService,
  ) {}

  /** 입하 가능 PO 목록 조회 (CONFIRMED/PARTIAL 상태) */
  async findReceivablePOs(company?: string, plant?: string) {
    const where: any = {
      status: In(['CONFIRMED', 'PARTIAL']),
    };
    if (company) where.company = company;
    if (plant) where.plant = plant;

    const pos = await this.purchaseOrderRepository.find({
      where,
      order: { orderDate: 'DESC' },
    });

    // PO 아이템 조회
    const poNos = pos.map((po) => po.poNo);
    const items = await this.purchaseOrderItemRepository.find({
      where: { poNo: In(poNos) },
    });

    const itemCodes = items.map((item) => item.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // PO별 아이템 그룹화
    const itemsByPoNo = new Map<string, typeof items>();
    for (const item of items) {
      if (!itemsByPoNo.has(item.poNo)) {
        itemsByPoNo.set(item.poNo, []);
      }
      itemsByPoNo.get(item.poNo)!.push(item);
    }

    return pos.map((po) => {
      const poItems = itemsByPoNo.get(po.poNo) || [];
      const enrichedItems = poItems.map((item) => ({
        ...item,
        remainingQty: item.orderQty - item.receivedQty,
        itemCode: partMap.get(item.itemCode)?.itemCode,
        itemName: partMap.get(item.itemCode)?.itemName,
        unit: partMap.get(item.itemCode)?.unit,
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
  async getPoItems(poNo: string) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo },
    });

    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${poNo}`);

    const items = await this.purchaseOrderItemRepository.find({
      where: { poNo },
    });

    const itemCodes = items.map((item: PurchaseOrderItem) => item.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p: PartMaster) => [p.itemCode, p]));

    return {
      ...po,
      items: items
        .map((item: PurchaseOrderItem) => ({
          ...item,
          remainingQty: item.orderQty - item.receivedQty,
          itemCode: partMap.get(item.itemCode)?.itemCode,
          itemName: partMap.get(item.itemCode)?.itemName,
          unit: partMap.get(item.itemCode)?.unit,
        }))
        .filter((item) => item.remainingQty > 0),
    };
  }

  /** PO 기반 입하 등록 (핵심 트랜잭션) */
  async createPoArrival(dto: CreatePoArrivalDto) {
    const po = await this.purchaseOrderRepository.findOne({
      where: { poNo: dto.poId },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${dto.poId}`);
    if (!['CONFIRMED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException(`입하 불가 상태입니다: ${po.status}`);
    }

    const poItems = await this.purchaseOrderItemRepository.find({
      where: { poNo: dto.poId },
    });

    // 잔량 검증
    for (const item of dto.items) {
      const poItem = poItems.find((pi) => pi.id === Number(item.poItemId));
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
      const arrivalNo = await this.numRuleService.nextNumberInTx(queryRunner, 'ARRIVAL');

      for (const item of dto.items) {
        const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');
        const lotNo = item.lotNo || await this.numRuleService.nextNumberInTx(queryRunner, 'LOT');

        // 1. LOT 생성 (제조일자 + 유효기한 자동 계산)
        const part = await this.partMasterRepository.findOne({ where: { itemCode: item.itemCode } });
        const mfgDate = item.manufactureDate ? new Date(item.manufactureDate) : null;
        let expDate: Date | null = null;
        if (mfgDate && part?.expiryDate && part.expiryDate > 0) {
          expDate = new Date(mfgDate);
          expDate.setDate(expDate.getDate() + part.expiryDate);
        }

        const lot = queryRunner.manager.create(MatLot, {
          lotNo,
          itemCode: item.itemCode,
          initQty: item.receivedQty,
          currentQty: item.receivedQty,
          recvDate: new Date(),
          manufactureDate: mfgDate,
          expireDate: expDate,
          poNo: po.poNo,
          vendor: po.partnerName,
        });
        const savedLot = await queryRunner.manager.save(lot);

        // 2. MatArrival 생성 (입하 업무 테이블)
        const arrival = queryRunner.manager.create(MatArrival, {
          arrivalNo,
          invoiceNo: dto.invoiceNo || null,
          poId: dto.poId,
          poItemId: item.poItemId,
          poNo: po.poNo,
          vendorId: po.partnerId,
          vendorName: po.partnerName,
          lotId: savedLot.lotNo,
          itemCode: item.itemCode,
          qty: item.receivedQty,
          warehouseCode: item.warehouseId,
          arrivalType: 'PO',
          workerId: dto.workerId,
          remark: item.remark || dto.remark,
          status: 'DONE',
        });
        await queryRunner.manager.save(arrival);

        // 3. StockTransaction 생성 (수불원장)
        const stockTx = queryRunner.manager.create(StockTransaction, {
          transNo,
          transType: 'MAT_IN',
          toWarehouseId: item.warehouseId,
          itemCode: item.itemCode,
          lotNo: savedLot.lotNo,
          qty: item.receivedQty,
          remark: item.remark || dto.remark,
          workerId: dto.workerId,
          refType: 'PO',
          refId: item.poItemId,
        });
        const savedTx = await queryRunner.manager.save(stockTx);

        // 4. Stock upsert (현재고 반영)
        await this.upsertStock(queryRunner.manager, item.warehouseId, item.itemCode, savedLot.lotNo, item.receivedQty);

        // 5. PurchaseOrderItem.receivedQty 증가
        const poItem = poItems.find((pi) => pi.id === Number(item.poItemId));
        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, poItem.id, {
            receivedQty: poItem.receivedQty + item.receivedQty,
          });
        }

        // part, warehouse 정보 조회 (part는 이미 위에서 조회)
        const warehouse = await this.warehouseRepository.findOne({ where: { warehouseCode: item.warehouseId } });

        results.push({
          ...savedTx,
          arrivalNo,
          itemCode: part?.itemCode,
          itemName: part?.itemName,
          itemType: part?.itemType,
          unit: part?.unit,
          lotNo: savedLot?.lotNo,
          warehouseCode: warehouse?.warehouseCode,
          warehouseName: warehouse?.warehouseName,
        });
      }

      // 5. PO 상태 재계산
      await this.updatePOStatus(queryRunner.manager, po.poNo);

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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const arrivalNo = await this.numRuleService.nextNumberInTx(queryRunner, 'ARRIVAL');
      const transNo = await this.numRuleService.nextNumberInTx(queryRunner, 'STOCK_TX');
      const lotNo = dto.lotNo || await this.numRuleService.nextNumberInTx(queryRunner, 'LOT');
      // 1. LOT 생성 (제조일자 + 유효기한 자동 계산)
      const part = await this.partMasterRepository.findOne({ where: { itemCode: dto.itemCode } });
      const mfgDate = dto.manufactureDate ? new Date(dto.manufactureDate) : null;
      let expDate: Date | null = null;
      if (mfgDate && part?.expiryDate && part.expiryDate > 0) {
        expDate = new Date(mfgDate);
        expDate.setDate(expDate.getDate() + part.expiryDate);
      }

      const lot = queryRunner.manager.create(MatLot, {
        lotNo,
        itemCode: dto.itemCode,
        initQty: dto.qty,
        currentQty: dto.qty,
        recvDate: new Date(),
        manufactureDate: mfgDate,
        expireDate: expDate,
        vendor: dto.vendor,
      });
      const savedLot = await queryRunner.manager.save(lot);

      // 2. MatArrival 생성 (입하 업무 테이블)
      const arrival = queryRunner.manager.create(MatArrival, {
        arrivalNo,
        invoiceNo: dto.invoiceNo || null,
        vendorId: dto.vendorId || null,
        vendorName: dto.vendor || null,
        lotId: savedLot.lotNo,
        itemCode: dto.itemCode,
        qty: dto.qty,
        warehouseCode: dto.warehouseId,
        arrivalType: 'MANUAL',
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
      });
      await queryRunner.manager.save(arrival);

      // 3. StockTransaction 생성 (수불원장)
      const stockTx = queryRunner.manager.create(StockTransaction, {
        transNo,
        transType: 'MAT_IN',
        toWarehouseId: dto.warehouseId,
        itemCode: dto.itemCode,
        lotNo: savedLot.lotNo,
        qty: dto.qty,
        remark: dto.remark,
        workerId: dto.workerId,
        refType: 'MANUAL',
      });
      const savedTx = await queryRunner.manager.save(stockTx);

      // 4. Stock upsert
      await this.upsertStock(queryRunner.manager, dto.warehouseId, dto.itemCode, savedLot.lotNo, dto.qty);

      // warehouse 정보 조회 (part는 이미 위에서 조회)
      const warehouse = await this.warehouseRepository.findOne({ where: { warehouseCode: dto.warehouseId } });

      await queryRunner.commitTransaction();

      return {
        ...savedTx,
        arrivalNo,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        itemType: part?.itemType,
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
        '(tx.transNo LIKE :search OR tx.itemCode IN (SELECT item_code FROM item_masters WHERE item_code LIKE :search OR part_name LIKE :search))',
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
    const itemCodes = data.map((item) => item.itemCode).filter(Boolean);
    const lotNos = data.map((item) => item.lotNo).filter(Boolean) as string[];
    const warehouseIds = data.map((item) => item.toWarehouseId).filter(Boolean) as string[];

    const [parts, lots, warehouses] = await Promise.all([
      itemCodes.length > 0 ? this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }) : Promise.resolve([]),
      lotNos.length > 0 ? this.matLotRepository.find({ where: { lotNo: In(lotNos) } }) : Promise.resolve([]),
      warehouseIds.length > 0 ? this.warehouseRepository.find({ where: { warehouseCode: In(warehouseIds) } }) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.lotNo, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // MatArrival 정보 조회 (인보이스번호, 거래처 등)
    const arrivalRecords = lotNos.length > 0
      ? await this.matArrivalRepository.find({ where: { lotId: In(lotNos) } })
      : [];
    const arrivalByLotId = new Map(arrivalRecords.map((a) => [a.lotId, a]));

    const flattenedData = data.map((item) => {
      const part = partMap.get(item.itemCode);
      const lot = item.lotNo ? lotMap.get(item.lotNo) : null;
      const warehouse = item.toWarehouseId ? warehouseMap.get(item.toWarehouseId) : null;
      const arrival = item.lotNo ? arrivalByLotId.get(item.lotNo) : null;

      return {
        ...item,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        itemType: part?.itemType,
        unit: part?.unit,
        lotNo: lot?.lotNo,
        warehouseCode: warehouse?.warehouseCode,
        warehouseName: warehouse?.warehouseName,
        arrivalNo: arrival?.arrivalNo,
        invoiceNo: arrival?.invoiceNo,
        vendorId: arrival?.vendorId,
        vendorName: arrival?.vendorName,
        arrivalType: arrival?.arrivalType,
      };
    });

    return { data: flattenedData, total, page, limit };
  }

  /** 입하 취소 (역분개 트랜잭션) */
  async cancel(dto: CancelArrivalDto) {
    const original = await this.stockTransactionRepository.findOne({
      where: { id: Number(dto.transactionId) },
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
      await queryRunner.manager.update(StockTransaction, Number(dto.transactionId), { status: 'CANCELED' });

      // 1-1. MatArrival도 CANCELED 처리 (LOT 기준으로 찾기)
      if (original.lotNo) {
        const arrivalRecord = await queryRunner.manager.findOne(MatArrival, {
          where: { lotId: original.lotNo, status: 'DONE' },
        });
        if (arrivalRecord) {
          await queryRunner.manager.update(MatArrival, arrivalRecord.id, { status: 'CANCELED' });
        }
      }

      // 2. 역분개 트랜잭션 생성
      const cancelTx = queryRunner.manager.create(StockTransaction, {
        transNo: cancelTransNo,
        transType: 'MAT_IN_CANCEL',
        fromWarehouseId: original.toWarehouseId,
        itemCode: original.itemCode,
        lotNo: original.lotNo,
        qty: -original.qty,
        remark: dto.reason,
        workerId: dto.workerId,
        cancelRefId: String(original.id),
        refType: 'CANCEL',
      });
      const savedCancelTx = await queryRunner.manager.save(cancelTx);

      // 3. Stock 감소
      if (original.toWarehouseId) {
        await this.upsertStock(
          queryRunner.manager, original.toWarehouseId, original.itemCode, original.lotNo, -original.qty,
        );
      }

      // 4. LOT.currentQty 감소
      if (original.lotNo) {
        const lot = await queryRunner.manager.findOne(MatLot, { where: { lotNo: original.lotNo } });
        if (lot) {
          const newQty = Math.max(0, lot.currentQty - original.qty);
          await queryRunner.manager.update(MatLot, lot.lotNo, {
            currentQty: newQty,
            status: newQty === 0 ? 'DEPLETED' : lot.status,
          });
        }
      }

      // 5. PO receivedQty 감소 + PO status 재계산
      if (original.refType === 'PO' && original.refId) {
        const poItem = await queryRunner.manager.findOne(PurchaseOrderItem, { where: { id: Number(original.refId) } });
        if (poItem) {
          await queryRunner.manager.update(PurchaseOrderItem, poItem.id, {
            receivedQty: Math.max(0, poItem.receivedQty - original.qty),
          });
          await this.updatePOStatus(queryRunner.manager, poItem.poNo);
        }
      }

      // part, lot, warehouse 정보 조회
      const [part, lot, toWarehouse] = await Promise.all([
        this.partMasterRepository.findOne({ where: { itemCode: original.itemCode } }),
        original.lotNo ? this.matLotRepository.findOne({ where: { lotNo: original.lotNo } }) : null,
        original.toWarehouseId ? this.warehouseRepository.findOne({ where: { warehouseCode: original.toWarehouseId } }) : null,
      ]);

      await queryRunner.commitTransaction();

      return {
        ...savedCancelTx,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        itemType: part?.itemType,
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
        where: { status: In(['CONFIRMED', 'PARTIAL']) },
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

  /** 입하재고현황 조회 (MAT_ARRIVALS 기반 + 현재고 조인) */
  async getArrivalStockStatus(query: ArrivalStockQueryDto) {
    const { search, fromDate, toDate } = query;

    const qb = this.matArrivalRepository.createQueryBuilder('a')
      .where('a.status = :status', { status: 'DONE' });

    if (fromDate && toDate) {
      qb.andWhere('a.arrivalDate BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(fromDate),
        toDate: new Date(toDate + 'T23:59:59'),
      });
    } else if (fromDate) {
      qb.andWhere('a.arrivalDate >= :fromDate', { fromDate: new Date(fromDate) });
    } else if (toDate) {
      qb.andWhere('a.arrivalDate <= :toDate', { toDate: new Date(toDate + 'T23:59:59') });
    }

    const arrivals = await qb.orderBy('a.arrivalDate', 'DESC').getMany();

    if (arrivals.length === 0) {
      return {
        data: [],
        stats: { totalArrivalQty: 0, totalCurrentStock: 0, partCount: 0, lotCount: 0 },
      };
    }

    // 관련 ID 수집
    const itemCodes = [...new Set(arrivals.map((a) => a.itemCode))];
    const lotNos = [...new Set(arrivals.map((a) => a.lotId))];
    const warehouseCodes = [...new Set(arrivals.map((a) => a.warehouseCode))];

    // 병렬 조회
    const [parts, lots, warehouses, stocks] = await Promise.all([
      this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } }),
      this.matLotRepository.find({ where: { lotNo: In(lotNos) } }),
      this.warehouseRepository.find({ where: { warehouseCode: In(warehouseCodes) } }),
      this.matStockRepository.find({
        where: { itemCode: In(itemCodes), warehouseCode: In(warehouseCodes) },
      }),
    ]);

    const partMap = new Map(parts.map((p) => [p.itemCode, p]));
    const lotMap = new Map(lots.map((l) => [l.lotNo, l]));
    const warehouseMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));

    // Stock 맵: warehouseCode_itemCode_lotNo → qty
    const stockMap = new Map<string, number>();
    for (const s of stocks) {
      const key = `${s.warehouseCode}_${s.itemCode}_${s.lotNo || ''}`;
      stockMap.set(key, (stockMap.get(key) || 0) + s.qty);
    }

    let data = arrivals.map((a) => {
      const part = partMap.get(a.itemCode);
      const lot = lotMap.get(a.lotId);
      const warehouse = warehouseMap.get(a.warehouseCode);
      const stockKey = `${a.warehouseCode}_${a.itemCode}_${a.lotId || ''}`;
      const currentStock = stockMap.get(stockKey) ?? 0;

      return {
        id: a.id,
        arrivalNo: a.arrivalNo,
        invoiceNo: a.invoiceNo,
        poNo: a.poNo,
        vendorName: a.vendorName,
        itemCode: part?.itemCode,
        itemName: part?.itemName,
        unit: part?.unit,
        lotNo: lot?.lotNo,
        arrivalQty: a.qty,
        currentStock,
        warehouseName: warehouse?.warehouseName || a.warehouseCode,
        arrivalType: a.arrivalType,
        arrivalDate: a.arrivalDate,
        manufactureDate: lot?.manufactureDate,
        expireDate: lot?.expireDate,
      };
    });

    // 검색 필터 (메모리 필터링)
    if (search) {
      const s = search.toLowerCase();
      data = data.filter((d) =>
        (d.itemCode && d.itemCode.toLowerCase().includes(s)) ||
        (d.itemName && d.itemName.toLowerCase().includes(s)) ||
        (d.poNo && d.poNo.toLowerCase().includes(s)) ||
        (d.invoiceNo && d.invoiceNo.toLowerCase().includes(s)) ||
        (d.arrivalNo && d.arrivalNo.toLowerCase().includes(s)) ||
        (d.lotNo && d.lotNo.toLowerCase().includes(s)),
      );
    }

    // 통계
    const stats = {
      totalArrivalQty: data.reduce((sum, d) => sum + d.arrivalQty, 0),
      totalCurrentStock: data.reduce((sum, d) => sum + d.currentStock, 0),
      partCount: new Set(data.map((d) => d.itemCode)).size,
      lotCount: new Set(data.map((d) => d.lotNo)).size,
    };

    return { data, stats };
  }

  /** PO 상태 재계산 */
  private async updatePOStatus(manager: any, poNo: string) {
    const poItems = await manager.find(PurchaseOrderItem, {
      where: { poNo },
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

    await manager.update(PurchaseOrder, poNo, { status: newStatus });
  }

  /** MatStock upsert (현재고 증감) */
  private async upsertStock(manager: any, warehouseCode: string, itemCode: string, lotNo: string | null, qtyDelta: number) {
    const existing = await manager.findOne(MatStock, {
      where: { warehouseCode, itemCode, lotNo: lotNo || null },
    });

    if (existing) {
      const newQty = Math.max(0, existing.qty + qtyDelta);
      await manager.update(MatStock,
        { warehouseCode: existing.warehouseCode, itemCode: existing.itemCode, lotNo: existing.lotNo },
        { qty: newQty, availableQty: Math.max(0, newQty - existing.reservedQty) },
      );
    } else if (qtyDelta > 0) {
      const newStock = manager.create(MatStock, {
        warehouseCode,
        itemCode,
        lotNo,
        qty: qtyDelta,
        availableQty: qtyDelta,
      });
      await manager.save(newStock);
    }
  }
}
