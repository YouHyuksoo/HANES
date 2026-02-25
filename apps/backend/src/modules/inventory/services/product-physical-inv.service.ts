/**
 * @file src/modules/inventory/services/product-physical-inv.service.ts
 * @description 제품 재고실사 비즈니스 로직 - Stock(제품/반제품) 대사 + InvAdjLog 기록
 *
 * 초보자 가이드:
 * 1. findStocks(): Stock + PartMaster + Lot 조인 → 실사 대상 목록
 * 2. findHistory(): InvAdjLog(adjType=PRODUCT_PHYSICAL_COUNT) 이력 조회
 * 3. applyCount(): 트랜잭션 기반 — Stock 수량 업데이트 + InvAdjLog 기록
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProductStock } from '../../../entities/product-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  CreateProductPhysicalInvDto,
  ProductPhysicalInvQueryDto,
  ProductPhysicalInvHistoryQueryDto,
} from '../dto/product-physical-inv.dto';

@Injectable()
export class ProductPhysicalInvService {
  constructor(
    @InjectRepository(ProductStock)
    private readonly stockRepository: Repository<ProductStock>,
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatLot)
    private readonly lotRepository: Repository<MatLot>,
    @InjectRepository(Warehouse)
    private readonly warehouseRepository: Repository<Warehouse>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** 실사 대상 Stock 목록 조회 */
  async findStocks(query: ProductPhysicalInvQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, warehouseId } = query;
    const skip = (page - 1) * limit;

    const qb = this.stockRepository
      .createQueryBuilder('s')
      .leftJoin(PartMaster, 'p', 'p.id = s.itemCode')
      .leftJoin(MatLot, 'l', 'l.id = s.lotNo')
      .leftJoin(Warehouse, 'w', 'w.warehouseCode = s.warehouseCode')
      .select([
        's.id AS "id"',
        's.warehouseCode AS "warehouseId"',
        'w.warehouseName AS "warehouseName"',
        's.itemCode AS "itemCode"',
        'p.itemCode AS "itemCode"',
        'p.itemName AS "itemName"',
        'p.unit AS "unit"',
        'p.itemType AS "itemType"',
        's.lotNo AS "lotNo"',
        'l.lotNo AS "lotNo"',
        's.qty AS "qty"',
        's.reservedQty AS "reservedQty"',
        's.availableQty AS "availableQty"',
        's.lastCountAt AS "lastCountAt"',
      ])
      .where('s.qty > 0');

    if (company) {
      qb.andWhere('s.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('s.plant = :plant', { plant });
    }
    if (warehouseId) {
      qb.andWhere('s.warehouseCode = :warehouseId', { warehouseId });
    }

    if (search) {
      qb.andWhere(
        '(LOWER(p.itemCode) LIKE :search OR LOWER(p.itemName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('p.itemCode', 'ASC').addOrderBy('l.lotNo', 'ASC');

    const total = await qb.getCount();
    const data = await qb.offset(skip).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  /** 실사 이력 조회 (InvAdjLog adjType=PRODUCT_PHYSICAL_COUNT) */
  async findHistory(query: ProductPhysicalInvHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, warehouseId, startDate, endDate } = query;

    const qb = this.invAdjLogRepository
      .createQueryBuilder('log')
      .leftJoin(PartMaster, 'part', 'part.itemCode = log.itemCode')
      .leftJoin(MatLot, 'lot', 'lot.lotNo = log.lotNo')
      .leftJoin(Warehouse, 'wh', 'wh.id = log.warehouseCode')
      .select([
        'log.id AS "id"',
        'log.warehouseCode AS "warehouseId"',
        'wh.warehouseName AS "warehouseName"',
        'log.itemCode AS "itemCode"',
        'part.itemCode AS "itemCode"',
        'part.itemName AS "itemName"',
        'part.unit AS "unit"',
        'log.lotNo AS "lotNo"',
        'lot.lotNo AS "lotNo"',
        'log.beforeQty AS "beforeQty"',
        'log.afterQty AS "afterQty"',
        'log.diffQty AS "diffQty"',
        'log.reason AS "reason"',
        'log.createdBy AS "createdBy"',
        'log.createdAt AS "createdAt"',
      ])
      .where('log.adjType = :adjType', { adjType: 'PRODUCT_PHYSICAL_COUNT' });

    if (company) {
      qb.andWhere('log.company = :company', { company });
    }
    if (plant) {
      qb.andWhere('log.plant = :plant', { plant });
    }
    if (warehouseId) {
      qb.andWhere('log.warehouseCode = :warehouseId', { warehouseId });
    }
    if (startDate) {
      qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(startDate) });
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      qb.andWhere('log.createdAt < :endDate', { endDate: end });
    }
    if (search) {
      qb.andWhere(
        '(LOWER(part.itemCode) LIKE :search OR LOWER(part.itemName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('log.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.offset((page - 1) * limit).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  /** 실사 결과 반영 (Stock 수량 업데이트 + InvAdjLog 기록) */
  async applyCount(dto: CreateProductPhysicalInvDto) {
    const { items, createdBy, countMonth, countType } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];

      for (const item of items) {
        const stock = await queryRunner.manager.findOne(ProductStock, {
          where: { id: item.stockId },
        });

        if (!stock) {
          throw new NotFoundException(`재고를 찾을 수 없습니다: ${item.stockId}`);
        }

        const beforeQty = stock.qty;
        const afterQty = item.countedQty;
        const diffQty = afterQty - beforeQty;

        // Stock 수량 업데이트
        await queryRunner.manager.update(ProductStock, stock.id, {
          qty: afterQty,
          availableQty: afterQty - stock.reservedQty,
          lastCountAt: new Date(),
        });

        // InvAdjLog 기록
        const invAdjLog = queryRunner.manager.create(InvAdjLog, {
          warehouseCode: stock.warehouseCode,
          itemCode: stock.itemCode,
          lotNo: stock.lotNo,
          adjType: 'PRODUCT_PHYSICAL_COUNT',
          beforeQty,
          afterQty,
          diffQty,
          reason: [
            countType === 'CANCEL' ? '[취소]' : null,
            countMonth ? `[${countMonth}]` : null,
            item.remark || '제품재고실사',
          ].filter(Boolean).join(' '),
          createdBy,
        });

        const savedLog = await queryRunner.manager.save(invAdjLog);
        results.push(savedLog);
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
}
