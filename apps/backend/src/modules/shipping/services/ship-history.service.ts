/**
 * @file src/modules/shipping/services/ship-history.service.ts
 * @description 출하이력 조회 전용 서비스
 *
 * 초보자 가이드:
 * 1. ShipmentOrder 테이블에서 출하 이력을 조회
 * 2. 조회 전용 (CRUD 없음)
 * 3. 다양한 필터링 (상태, 날짜, 고객명 등) 지원
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ShipHistoryQueryDto } from '../dto/ship-history.dto';

@Injectable()
export class ShipHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 출하이력 목록 조회 */
  async findAll(query: ShipHistoryQueryDto) {
    const { page = 1, limit = 10, search, status, shipDateFrom, shipDateTo, customerName } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(customerName && { customerName: { contains: customerName, mode: 'insensitive' as const } }),
      ...(search && {
        OR: [
          { shipOrderNo: { contains: search, mode: 'insensitive' as const } },
          { customerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(shipDateFrom || shipDateTo
        ? {
            shipDate: {
              ...(shipDateFrom && { gte: new Date(shipDateFrom) }),
              ...(shipDateTo && { lte: new Date(shipDateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.shipmentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              part: { select: { id: true, partCode: true, partName: true } },
            },
          },
        },
      }),
      this.prisma.shipmentOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 출하이력 통계 요약 */
  async getSummary() {
    const [total, byStatus] = await Promise.all([
      this.prisma.shipmentOrder.count({ where: { deletedAt: null } }),
      this.prisma.shipmentOrder.groupBy({
        by: ['status'],
        where: { deletedAt: null },
        _count: { status: true },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.status })),
    };
  }
}
