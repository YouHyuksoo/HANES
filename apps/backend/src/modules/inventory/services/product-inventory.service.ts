/**
 * @file src/modules/inventory/services/product-inventory.service.ts
 * @description 제품(WIP/FG) 수불관리 서비스 - PRODUCT_STOCKS/PRODUCT_TRANSACTIONS 테이블 사용
 *
 * 초보자 가이드:
 * - 원자재(RAW)는 InventoryService(MAT_STOCKS) 사용
 * - 제품(WIP/FG)은 이 서비스(PRODUCT_STOCKS) 사용
 * - 핵심 원칙: 모든 수불 이력 보존, 취소 시 역분개
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, In } from 'typeorm';
import { ProductStock } from '../../../entities/product-stock.entity';
import { ProductTransaction } from '../../../entities/product-transaction.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  ProductReceiveStockDto,
  ProductIssueStockDto,
  ProductTransactionQueryDto,
  ProductStockQueryDto,
} from '../dto/product-inventory.dto';
import { CancelTransactionDto } from '../dto/inventory.dto';

@Injectable()
export class ProductInventoryService {
  constructor(
    @InjectRepository(ProductTransaction)
    private readonly transactionRepository: Repository<ProductTransaction>,
    @InjectRepository(ProductStock)
    private readonly stockRepository: Repository<ProductStock>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** 제품 트랜잭션 번호 생성 (PTX20260224XXXXX 형식) */
  private async generateTransNo(): Promise<string> {
    const today = new Date();
    const prefix = `PTX${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const lastTrans = await this.transactionRepository
      .createQueryBuilder('t')
      .where('t.transNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('t.transNo', 'DESC')
      .getOne();

    let seq = 1;
    if (lastTrans) {
      const lastSeq = parseInt(lastTrans.transNo.slice(-5), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  /** 제품 입고 처리 */
  async receiveStock(dto: ProductReceiveStockDto) {
    const transNo = await this.generateTransNo();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 트랜잭션 생성
      const transaction = this.transactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        toWarehouseId: dto.warehouseId,
        itemCode: dto.itemCode,
        itemType: dto.itemType,
        lotNo: dto.lotNo,
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        qty: dto.qty,
        unitPrice: dto.unitPrice,
        totalAmount: dto.unitPrice ? dto.unitPrice * dto.qty : null,
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        remark: dto.remark,
        status: 'DONE',
      });

      const savedTransaction = await queryRunner.manager.save(ProductTransaction, transaction);

      // 2. 재고 업데이트
      const existingStock = await queryRunner.manager.findOne(ProductStock, {
        where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, lotNo: dto.lotNo || IsNull() },
      });

      if (existingStock) {
        await queryRunner.manager.update(ProductStock, existingStock.id, {
          qty: existingStock.qty + dto.qty,
          availableQty: existingStock.qty + dto.qty - existingStock.reservedQty,
        });
      } else {
        await queryRunner.manager.save(ProductStock, {
          warehouseCode: dto.warehouseId,
          itemCode: dto.itemCode,
          itemType: dto.itemType,
          lotNo: dto.lotNo || null,
          orderNo: dto.orderNo || null,
          processCode: dto.processCode || null,
          qty: dto.qty,
          reservedQty: 0,
          availableQty: dto.qty,
        });
      }

      await queryRunner.commitTransaction();
      return savedTransaction;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 제품 출고 처리 */
  async issueStock(dto: ProductIssueStockDto) {
    const transNo = await this.generateTransNo();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 재고 확인
      const stock = await queryRunner.manager.findOne(ProductStock, {
        where: { warehouseCode: dto.warehouseId, itemCode: dto.itemCode, lotNo: dto.lotNo || IsNull() },
      });

      if (!stock || stock.availableQty < dto.qty) {
        throw new BadRequestException(`재고 부족: 가용 ${stock?.availableQty || 0}, 요청 ${dto.qty}`);
      }

      // 2. 트랜잭션 생성
      const transaction = this.transactionRepository.create({
        transNo,
        transType: dto.transType,
        transDate: new Date(),
        fromWarehouseId: dto.warehouseId,
        toWarehouseId: dto.toWarehouseId,
        itemCode: dto.itemCode,
        itemType: dto.itemType,
        lotNo: dto.lotNo,
        orderNo: dto.orderNo,
        processCode: dto.processCode,
        qty: -dto.qty,
        refType: dto.refType,
        refId: dto.refId,
        workerId: dto.workerId,
        issueType: dto.issueType,
        remark: dto.remark,
        status: 'DONE',
      });

      const savedTransaction = await queryRunner.manager.save(ProductTransaction, transaction);

      // 3. 출고 창고 재고 감소
      await queryRunner.manager.update(ProductStock, stock.id, {
        qty: stock.qty - dto.qty,
        availableQty: stock.availableQty - dto.qty,
      });

      // 4. 이동 대상 창고가 있으면 입고 처리
      if (dto.toWarehouseId) {
        const targetStock = await queryRunner.manager.findOne(ProductStock, {
          where: { warehouseCode: dto.toWarehouseId, itemCode: dto.itemCode, lotNo: dto.lotNo || IsNull() },
        });

        if (targetStock) {
          await queryRunner.manager.update(ProductStock, targetStock.id, {
            qty: targetStock.qty + dto.qty,
            availableQty: targetStock.qty + dto.qty - targetStock.reservedQty,
          });
        } else {
          await queryRunner.manager.save(ProductStock, {
            warehouseCode: dto.toWarehouseId,
            itemCode: dto.itemCode,
            itemType: dto.itemType,
            lotNo: dto.lotNo || null,
            orderNo: dto.orderNo || null,
            processCode: dto.processCode || null,
            qty: dto.qty,
            reservedQty: 0,
            availableQty: dto.qty,
          });
        }
      }

      await queryRunner.commitTransaction();
      return savedTransaction;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 제품 트랜잭션 취소 (입고취소, 출고취소) */
  async cancelTransaction(dto: CancelTransactionDto) {
    const originalTrans = await this.transactionRepository.findOne({
      where: { id: dto.transactionId },
    });

    if (!originalTrans) {
      throw new NotFoundException('원본 트랜잭션을 찾을 수 없습니다.');
    }

    if (originalTrans.status === 'CANCELED') {
      throw new BadRequestException('이미 취소된 트랜잭션입니다.');
    }

    const cancelTransType = this.getCancelTransType(originalTrans.transType);
    const transNo = await this.generateTransNo();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. 원본 트랜잭션 상태 변경
      await queryRunner.manager.update(ProductTransaction, dto.transactionId, { status: 'CANCELED' });

      // 2. 취소 트랜잭션 생성 (반대 수량)
      const cancelTrans = this.transactionRepository.create({
        transNo,
        transType: cancelTransType,
        transDate: new Date(),
        fromWarehouseId: originalTrans.toWarehouseId,
        toWarehouseId: originalTrans.fromWarehouseId,
        itemCode: originalTrans.itemCode,
        itemType: originalTrans.itemType,
        lotNo: originalTrans.lotNo,
        orderNo: originalTrans.orderNo,
        processCode: originalTrans.processCode,
        qty: -originalTrans.qty,
        unitPrice: originalTrans.unitPrice,
        totalAmount: originalTrans.totalAmount ? -Number(originalTrans.totalAmount) : null,
        refType: originalTrans.refType,
        refId: originalTrans.refId,
        cancelRefId: originalTrans.id,
        workerId: dto.workerId,
        issueType: originalTrans.issueType,
        remark: dto.remark || `취소: ${originalTrans.transNo}`,
        status: 'DONE',
      });

      const savedCancelTrans = await queryRunner.manager.save(ProductTransaction, cancelTrans);

      // 3. 재고 복구 — 원래 입고 창고에서 감소
      if (originalTrans.toWarehouseId && originalTrans.qty > 0) {
        const stock = await queryRunner.manager.findOne(ProductStock, {
          where: {
            warehouseCode: originalTrans.toWarehouseId,
            itemCode: originalTrans.itemCode,
            lotNo: originalTrans.lotNo || IsNull(),
          },
        });

        if (stock) {
          const newQty = stock.qty - Math.abs(originalTrans.qty);
          if (newQty < 0) {
            throw new BadRequestException('재고가 부족하여 취소할 수 없습니다.');
          }
          await queryRunner.manager.update(ProductStock, stock.id, {
            qty: newQty,
            availableQty: newQty - stock.reservedQty,
          });
        }
      }

      // 원래 출고 창고로 복구
      if (originalTrans.fromWarehouseId && originalTrans.qty < 0) {
        const stock = await queryRunner.manager.findOne(ProductStock, {
          where: {
            warehouseCode: originalTrans.fromWarehouseId,
            itemCode: originalTrans.itemCode,
            lotNo: originalTrans.lotNo || IsNull(),
          },
        });

        if (stock) {
          await queryRunner.manager.update(ProductStock, stock.id, {
            qty: stock.qty + Math.abs(originalTrans.qty),
            availableQty: stock.availableQty + Math.abs(originalTrans.qty),
          });
        } else {
          await queryRunner.manager.save(ProductStock, {
            warehouseCode: originalTrans.fromWarehouseId,
            itemCode: originalTrans.itemCode,
            itemType: originalTrans.itemType || 'WIP',
            lotNo: originalTrans.lotNo || null,
            qty: Math.abs(originalTrans.qty),
            reservedQty: 0,
            availableQty: Math.abs(originalTrans.qty),
          });
        }
      }

      await queryRunner.commitTransaction();
      return savedCancelTrans;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 취소 트랜잭션 유형 결정 */
  private getCancelTransType(originalType: string): string {
    const cancelMap: Record<string, string> = {
      'WIP_IN': 'WIP_IN_CANCEL',
      'WIP_OUT': 'WIP_OUT_CANCEL',
      'FG_IN': 'FG_IN_CANCEL',
      'FG_OUT': 'FG_OUT_CANCEL',
    };
    return cancelMap[originalType] || `${originalType}_CANCEL`;
  }

  /** 제품 현재고 조회 */
  async getStock(query: ProductStockQueryDto, company?: string, plant?: string) {
    const where: any = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.warehouseId) where.warehouseCode = query.warehouseId;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.itemType) where.itemType = query.itemType;
    if (query.lotNo) where.lotNo = query.lotNo;

    const stocks = await this.stockRepository.find({
      where,
      select: ['id', 'warehouseCode', 'itemCode', 'itemType', 'lotNo', 'orderNo', 'processCode', 'qty', 'reservedQty', 'availableQty'],
      order: { warehouseCode: 'ASC', itemCode: 'ASC' },
    });

    let filtered = query.includeZero ? stocks : stocks.filter((s) => s.qty > 0);
    if (filtered.length === 0) return [];

    const whCodes = [...new Set(filtered.map((s) => s.warehouseCode).filter(Boolean))];
    const itemCodes = [...new Set(filtered.map((s) => s.itemCode).filter(Boolean))];

    const warehouses = whCodes.length > 0 ? await this.warehouseRepository.find({
      where: { warehouseCode: In(whCodes) },
      select: ['id', 'warehouseCode', 'warehouseName', 'warehouseType'],
    }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({
      where: { itemCode: In(itemCodes) },
      select: ['itemCode', 'itemName', 'itemType', 'unit'],
    }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w] as const));
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    if (query.warehouseType) {
      filtered = filtered.filter((s) => whMap.get(s.warehouseCode)?.warehouseType === query.warehouseType);
    }

    return filtered.map((s) => {
      const wh = whMap.get(s.warehouseCode);
      const part = partMap.get(s.itemCode);
      return {
        id: s.id,
        warehouseId: s.warehouseCode,
        itemCode: s.itemCode,
        itemType: s.itemType,
        lotNo: s.lotNo,
        orderNo: s.orderNo,
        processCode: s.processCode,
        qty: s.qty,
        reservedQty: s.reservedQty,
        availableQty: s.availableQty,
        itemCode: part?.itemCode || null,
        itemName: part?.itemName || null,
        unit: part?.unit || null,
        warehouseCode: wh?.warehouseCode || null,
        warehouseName: wh?.warehouseName || null,
        warehouseType: wh?.warehouseType || null,
      };
    });
  }

  /** 제품 수불 이력 조회 */
  async getTransactions(query: ProductTransactionQueryDto, company?: string, plant?: string) {
    const where: any = {};
    if (company) where.company = company;
    if (plant) where.plant = plant;
    if (query.itemCode) where.itemCode = query.itemCode;
    if (query.itemType) where.itemType = query.itemType;
    if (query.lotNo) where.lotNo = query.lotNo;
    if (query.refType) where.refType = query.refType;
    if (query.refId) where.refId = query.refId;

    const qb = this.transactionRepository.createQueryBuilder('trans')
      .where(where);

    // transType은 쉼표 구분 복수 값 지원
    if (query.transType) {
      const types = query.transType.split(',').map((t) => t.trim());
      if (types.length === 1) {
        qb.andWhere('trans.transType = :transType', { transType: types[0] });
      } else {
        qb.andWhere('trans.transType IN (:...transTypes)', { transTypes: types });
      }
    }

    if (query.warehouseId) {
      qb.andWhere(
        '(trans.fromWarehouseId = :warehouseId OR trans.toWarehouseId = :warehouseId)',
        { warehouseId: query.warehouseId },
      );
    }
    if (query.dateFrom) {
      qb.andWhere('trans.transDate >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      // dateTo를 해당일 23:59:59로 설정 (자정 기준이면 당일 데이터 누락됨)
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

    const warehouses = whIds.length > 0 ? await this.warehouseRepository.find({ where: { warehouseCode: In(whIds as string[]) } }) : [];
    const parts = itemCodes.length > 0 ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes as string[]) } }) : [];

    const whMap = new Map(warehouses.map((w) => [w.warehouseCode, w]));
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    return transactions.map((t) => ({
      ...t,
      fromWarehouse: t.fromWarehouseId ? whMap.get(t.fromWarehouseId) || null : null,
      toWarehouse: t.toWarehouseId ? whMap.get(t.toWarehouseId) || null : null,
      part: partMap.get(t.itemCode) || null,
    }));
  }
}
