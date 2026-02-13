/**
 * @file src/modules/material/services/physical-inv.service.ts
 * @description 재고실사 비즈니스 로직 - Stock 대사 후 차이분 InvAdjLog 생성
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePhysicalInvDto, PhysicalInvQueryDto } from '../dto/physical-inv.dto';

@Injectable()
export class PhysicalInvService {
  constructor(private readonly prisma: PrismaService) {}

  /** 실사 대상 재고 목록 조회 */
  async findStocks(query: PhysicalInvQueryDto) {
    const { page = 1, limit = 10, search, warehouseId } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(warehouseId && { warehouseId }),
      ...(search && {
        OR: [
          { part: { partCode: { contains: search, mode: 'insensitive' as const } } },
          { part: { partName: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        skip,
        take: limit,
        include: {
          part: { select: { id: true, partCode: true, partName: true, unit: true } },
          warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          lot: { select: { id: true, lotNo: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.stock.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 실사 결과 반영 */
  async applyCount(dto: CreatePhysicalInvDto) {
    const results = [];

    for (const item of dto.items) {
      const stock = await this.prisma.stock.findFirst({ where: { id: item.stockId } });
      if (!stock) throw new NotFoundException(`재고를 찾을 수 없습니다: ${item.stockId}`);

      const diff = item.countedQty - stock.qty;
      if (diff === 0) continue;

      await this.prisma.stock.update({
        where: { id: item.stockId },
        data: {
          qty: item.countedQty,
          availableQty: item.countedQty - stock.reservedQty,
          lastCountAt: new Date(),
        },
      });

      const adjLog = await this.prisma.invAdjLog.create({
        data: {
          warehouseCode: stock.warehouseId,
          partId: stock.partId,
          lotId: stock.lotId,
          adjType: 'PHYSICAL_COUNT',
          beforeQty: stock.qty,
          afterQty: item.countedQty,
          diffQty: diff,
          reason: item.remark ?? '재고실사',
          createdBy: dto.createdBy,
        },
      });

      results.push(adjLog);
    }

    return results;
  }
}
