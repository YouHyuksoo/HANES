/**
 * @file src/modules/material/services/shelf-life.service.ts
 * @description 유수명자재 조회 서비스 - 유효기한이 있는 LOT의 만료 현황
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShelfLifeQueryDto } from '../dto/shelf-life.dto';

@Injectable()
export class ShelfLifeService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ShelfLifeQueryDto) {
    const { page = 1, limit = 10, search, expiryStatus, nearExpiryDays = 30 } = query;
    const skip = (page - 1) * limit;
    const now = new Date();
    const nearDate = new Date(now.getTime() + nearExpiryDays * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = {
      deletedAt: null,
      expireDate: { not: null },
      currentQty: { gt: 0 },
      ...(search && {
        OR: [
          { lotNo: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    if (expiryStatus === 'EXPIRED') {
      where.expireDate = { lt: now };
    } else if (expiryStatus === 'NEAR_EXPIRY') {
      where.expireDate = { gte: now, lte: nearDate };
    } else if (expiryStatus === 'VALID') {
      where.expireDate = { gt: nearDate };
    }

    const [data, total] = await Promise.all([
      this.prisma.lot.findMany({
        where,
        skip,
        take: limit,
        include: { part: { select: { id: true, partCode: true, partName: true, unit: true } } },
        orderBy: { expireDate: 'asc' },
      }),
      this.prisma.lot.count({ where }),
    ]);

    const enriched = data.map((lot) => {
      const expire = lot.expireDate ? new Date(lot.expireDate) : null;
      let expiryLabel = 'VALID';
      let remainDays = 0;
      if (expire) {
        remainDays = Math.ceil((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (remainDays < 0) expiryLabel = 'EXPIRED';
        else if (remainDays <= nearExpiryDays) expiryLabel = 'NEAR_EXPIRY';
      }
      return { ...lot, expiryLabel, remainDays };
    });

    return { data: enriched, total, page, limit };
  }
}
