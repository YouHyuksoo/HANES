/**
 * @file src/modules/material/services/physical-inv.service.ts
 * @description 재고실사 비즈니스 로직 - Stock 대사 후 차이분 InvAdjLog 생성 (TypeORM)
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { MatStock } from '../../../entities/mat-stock.entity';
import { InvAdjLog } from '../../../entities/inv-adj-log.entity';
import { MatLot } from '../../../entities/mat-lot.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreatePhysicalInvDto, PhysicalInvQueryDto } from '../dto/physical-inv.dto';

@Injectable()
export class PhysicalInvService {
  constructor(
    @InjectRepository(MatStock)
    private readonly matStockRepository: Repository<MatStock>,
    @InjectRepository(InvAdjLog)
    private readonly invAdjLogRepository: Repository<InvAdjLog>,
    @InjectRepository(MatLot)
    private readonly matLotRepository: Repository<MatLot>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  async findStocks(query: PhysicalInvQueryDto) {
    const { page = 1, limit = 10, search, warehouseId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (warehouseId) {
      where.warehouseCode = warehouseId;
    }

    const [data, total] = await Promise.all([
      this.matStockRepository.find({
        where,
        skip,
        take: limit,
        order: { updatedAt: 'DESC' },
      }),
      this.matStockRepository.count({ where }),
    ]);

    // part, lot 정보 조회
    const partIds = data.map((stock) => stock.partId).filter(Boolean);
    const lotIds = data.map((stock) => stock.lotId).filter(Boolean) as string[];

    const [parts, lots] = await Promise.all([
      this.partMasterRepository.findByIds(partIds),
      lotIds.length > 0 ? this.matLotRepository.findByIds(lotIds) : Promise.resolve([]),
    ]);

    const partMap = new Map(parts.map((p) => [p.id, p]));
    const lotMap = new Map(lots.map((l) => [l.id, l]));

    let result = data.map((stock) => {
      const part = partMap.get(stock.partId);
      const lot = stock.lotId ? lotMap.get(stock.lotId) : null;
      return {
        ...stock,
        partCode: part?.partCode,
        partName: part?.partName,
        lotNo: lot?.lotNo,
      };
    });

    // 검색어 필터링
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (stock) =>
          stock.partCode?.toLowerCase().includes(searchLower) ||
          stock.partName?.toLowerCase().includes(searchLower),
      );
    }

    return { data: result, total, page, limit };
  }

  async applyCount(dto: CreatePhysicalInvDto) {
    const { items, createdBy } = dto;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results = [];

      for (const item of items) {
        // 기존 재고 조회
        const stock = await queryRunner.manager.findOne(MatStock, {
          where: { id: item.stockId },
        });

        if (!stock) {
          throw new NotFoundException(`재고를 찾을 수 없습니다: ${item.stockId}`);
        }

        const beforeQty = stock.qty;
        const afterQty = item.countedQty;
        const diffQty = afterQty - beforeQty;

        // 재고 업데이트
        await queryRunner.manager.update(MatStock, stock.id, {
          qty: afterQty,
          availableQty: afterQty - stock.reservedQty,
          lastCountAt: new Date(),
        });

        // 조정 이력 기록
        const invAdjLog = queryRunner.manager.create(InvAdjLog, {
          warehouseCode: stock.warehouseCode,
          partId: stock.partId,
          lotId: stock.lotId,
          adjType: 'PHYSICAL_COUNT',
          beforeQty,
          afterQty,
          diffQty,
          reason: item.remark || '재고실사',
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
