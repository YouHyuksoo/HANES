/**
 * @file src/modules/material/services/po-status.service.ts
 * @description PO현황 조회 서비스 - PO와 품목을 조인하여 입고율 등 현황 제공
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PoStatusQueryDto } from '../dto/po-status.dto';

@Injectable()
export class PoStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PoStatusQueryDto) {
    const { page = 1, limit = 10, search, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { poNo: { contains: search, mode: 'insensitive' as const } },
          { partnerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(fromDate && { orderDate: { gte: new Date(fromDate) } }),
      ...(toDate && { orderDate: { ...((fromDate && { gte: new Date(fromDate) }) || {}), lte: new Date(toDate) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        include: {
          items: {
            include: {
              part: { select: { id: true, partCode: true, partName: true, unit: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    const enriched = data.map((po) => {
      const totalOrderQty = po.items.reduce((s, i) => s + i.orderQty, 0);
      const totalReceivedQty = po.items.reduce((s, i) => s + i.receivedQty, 0);
      const receiveRate = totalOrderQty > 0 ? Math.round((totalReceivedQty / totalOrderQty) * 100) : 0;
      return { ...po, totalOrderQty, totalReceivedQty, receiveRate };
    });

    return { data: enriched, total, page, limit };
  }
}
