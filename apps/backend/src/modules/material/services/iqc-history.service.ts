/**
 * @file src/modules/material/services/iqc-history.service.ts
 * @description IQC 이력 조회 서비스
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IqcHistoryQueryDto } from '../dto/iqc-history.dto';

@Injectable()
export class IqcHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: IqcHistoryQueryDto) {
    const { page = 1, limit = 10, search, inspectType, result, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(inspectType && { inspectType }),
      ...(result && { result }),
      ...(search && {
        OR: [
          { lotNo: { contains: search, mode: 'insensitive' as const } },
          { inspectorName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(fromDate && { inspectDate: { gte: new Date(fromDate) } }),
      ...(toDate && { inspectDate: { ...((fromDate && { gte: new Date(fromDate) }) || {}), lte: new Date(toDate) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.iqcLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          part: { select: { id: true, partCode: true, partName: true, unit: true } },
        },
        orderBy: { inspectDate: 'desc' },
      }),
      this.prisma.iqcLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
