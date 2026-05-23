import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ProductStock } from '../../../entities/product-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { Warehouse } from '../../../entities/warehouse.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { TransactionService } from '../../../shared/transaction.service';
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
    private readonly tx: TransactionService,
  ) {}

  async findStocks(query: ProductPhysicalInvQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search } = query;
    const warehouseCode = query.warehouseCode ?? query.warehouseId;
    const skip = (page - 1) * limit;

    const qb = this.stockRepository
      .createQueryBuilder('s')
      .leftJoin(PartMaster, 'p', 'p.itemCode = s.itemCode')
      .leftJoin(MatLot, 'l', 'l.matUid = s.prdUid')
      .leftJoin(Warehouse, 'w', 'w.warehouseCode = s.warehouseCode')
      .select([
        's.warehouseCode || \'::\' || s.itemCode || \'::\' || s.prdUid AS "id"',
        's.warehouseCode AS "warehouseCode"',
        's.warehouseCode AS "warehouseId"',
        'w.warehouseName AS "warehouseName"',
        's.itemCode AS "itemCode"',
        'p.itemName AS "itemName"',
        'p.unit AS "unit"',
        'p.itemType AS "itemType"',
        's.prdUid AS "prdUid"',
        's.qty AS "qty"',
        's.reservedQty AS "reservedQty"',
        's.availableQty AS "availableQty"',
        's.lastCountAt AS "lastCountAt"',
      ])
      .where('s.qty > 0');

    if (company) qb.andWhere('s.company = :company', { company });
    if (plant) qb.andWhere('s.plant = :plant', { plant });
    if (warehouseCode) qb.andWhere('s.warehouseCode = :warehouseCode', { warehouseCode });

    if (search) {
      qb.andWhere(
        '(LOWER(p.itemCode) LIKE :search OR LOWER(p.itemName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('p.itemCode', 'ASC').addOrderBy('l.matUid', 'ASC');

    const total = await qb.getCount();
    const data = await qb.offset(skip).limit(limit).getRawMany();

    return { data, total, page, limit };
  }

  async findHistory(query: ProductPhysicalInvHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, search, startDate, endDate } = query;
    const warehouseCode = query.warehouseCode ?? query.warehouseId;

    const qb = this.invAdjLogRepository
      .createQueryBuilder('log')
      .leftJoin(PartMaster, 'part', 'part.itemCode = log.itemCode')
      .leftJoin(MatLot, 'lot', 'lot.matUid = log.matUid')
      .leftJoin(Warehouse, 'wh', 'wh.warehouseCode = log.warehouseCode')
      .select([
        'log.adjDate AS "adjDate"',
        'log.seq AS "seq"',
        'log.warehouseCode AS "warehouseCode"',
        'log.warehouseCode AS "warehouseId"',
        'wh.warehouseName AS "warehouseName"',
        'log.itemCode AS "itemCode"',
        'part.itemName AS "itemName"',
        'part.unit AS "unit"',
        'log.matUid AS "prdUid"',
        'log.beforeQty AS "beforeQty"',
        'log.afterQty AS "afterQty"',
        'log.diffQty AS "diffQty"',
        'log.reason AS "reason"',
        'log.createdBy AS "createdBy"',
        'log.createdAt AS "createdAt"',
      ])
      .where('log.adjType = :adjType', { adjType: 'PRODUCT_PHYSICAL_COUNT' });

    if (company) qb.andWhere('log.company = :company', { company });
    if (plant) qb.andWhere('log.plant = :plant', { plant });
    if (warehouseCode) qb.andWhere('log.warehouseCode = :warehouseCode', { warehouseCode });
    if (startDate) qb.andWhere('log.createdAt >= :startDate', { startDate: new Date(startDate) });
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

  async applyCount(dto: CreateProductPhysicalInvDto, company?: string, plant?: string, actor?: string) {
    const { items, countMonth, countType } = dto;
    const createdBy = actor || dto.createdBy || 'system';

    return this.tx.run(async (queryRunner) => {
      const results = [];

      for (const item of items) {
        const [warehouseCode, itemCode, prdUid] = item.stockId.split('::');
        if (!warehouseCode || !itemCode || !prdUid) {
          throw new NotFoundException(`잘못된 재고 ID 형식입니다: ${item.stockId}`);
        }

        const scopedKey: any = {
          warehouseCode,
          itemCode,
          prdUid,
          ...(company && { company }),
          ...(plant && { plant }),
        };

        const stock = await queryRunner.manager.findOne(ProductStock, {
          where: scopedKey,
        });

        if (!stock) {
          throw new NotFoundException(`재고를 찾을 수 없습니다: ${item.stockId}`);
        }

        const reservedQty = stock.reservedQty ?? 0;
        if (item.countedQty < reservedQty) {
          throw new BadRequestException(
            `실사수량(${item.countedQty})은 예약수량(${reservedQty})보다 작을 수 없습니다: ${item.stockId}`,
          );
        }

        const beforeQty = stock.qty;
        const afterQty = item.countedQty;
        const diffQty = afterQty - beforeQty;

        await queryRunner.manager.update(ProductStock, scopedKey, {
          qty: afterQty,
          availableQty: afterQty - reservedQty,
          lastCountAt: new Date(),
          updatedBy: createdBy,
        });

        const invAdjLog = queryRunner.manager.create(InvAdjLog, {
          warehouseCode: stock.warehouseCode,
          itemCode: stock.itemCode,
          matUid: stock.prdUid,
          adjType: 'PRODUCT_PHYSICAL_COUNT',
          beforeQty,
          afterQty,
          diffQty,
          company: stock.company,
          plant: stock.plant,
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

      return results;
    });
  }
}
