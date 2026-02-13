/**
 * @file src/modules/material/services/adjustment.service.ts
 * @description 재고보정 비즈니스 로직 - InvAdjLog 생성 + StockTransaction 기록
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateAdjustmentDto, AdjustmentQueryDto } from '../dto/adjustment.dto';

@Injectable()
export class AdjustmentService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AdjustmentQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { warehouseCode: { contains: search, mode: 'insensitive' as const } },
          { reason: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(fromDate && { createdAt: { gte: new Date(fromDate) } }),
      ...(toDate && { createdAt: { ...((fromDate && { gte: new Date(fromDate) }) || {}), lte: new Date(toDate) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.invAdjLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invAdjLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async create(dto: CreateAdjustmentDto) {
    const stock = await this.prisma.matStock.findFirst({
      where: { warehouseCode: dto.warehouseCode, partId: dto.partId, lotId: dto.lotId ?? null },
    });

    const beforeQty = stock?.qty ?? 0;
    const diffQty = dto.afterQty - beforeQty;

    return this.prisma.$transaction(async (tx) => {
      if (stock) {
        await tx.matStock.update({
          where: { id: stock.id },
          data: { qty: dto.afterQty, availableQty: dto.afterQty - (stock.reservedQty ?? 0) },
        });
      }

      const transNo = `ADJ-${Date.now().toString(36).toUpperCase()}`;
      await tx.stockTransaction.create({
        data: {
          transNo,
          transType: 'ADJUST',
          partId: dto.partId,
          lotId: dto.lotId,
          qty: diffQty,
          remark: dto.reason,
          refType: 'ADJUST',
        },
      });

      return tx.invAdjLog.create({
        data: {
          warehouseCode: dto.warehouseCode,
          partId: dto.partId,
          lotId: dto.lotId,
          adjType: diffQty >= 0 ? 'INCREASE' : 'DECREASE',
          beforeQty,
          afterQty: dto.afterQty,
          diffQty,
          reason: dto.reason,
          createdBy: dto.createdBy,
        },
      });
    });
  }
}
