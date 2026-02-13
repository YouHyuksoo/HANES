/**
 * @file src/modules/material/services/misc-receipt.service.ts
 * @description 기타입고 비즈니스 로직 - StockTransaction(MISC_IN) 생성
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateMiscReceiptDto, MiscReceiptQueryDto } from '../dto/misc-receipt.dto';

@Injectable()
export class MiscReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: MiscReceiptQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      transType: 'MISC_IN',
      status: 'DONE',
      ...(search && {
        OR: [
          { transNo: { contains: search, mode: 'insensitive' as const } },
          { remark: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(fromDate && { transDate: { gte: new Date(fromDate) } }),
      ...(toDate && { transDate: { ...((fromDate && { gte: new Date(fromDate) }) || {}), lte: new Date(toDate) } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          part: { select: { id: true, partCode: true, partName: true, unit: true } },
          lot: { select: { id: true, lotNo: true } },
          toWarehouse: { select: { id: true, warehouseName: true } },
        },
        orderBy: { transDate: 'desc' },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async create(dto: CreateMiscReceiptDto) {
    const transNo = `MISC-${Date.now().toString(36).toUpperCase()}`;

    return this.prisma.stockTransaction.create({
      data: {
        transNo,
        transType: 'MISC_IN',
        toWarehouseId: dto.warehouseId,
        partId: dto.partId,
        lotId: dto.lotId,
        qty: dto.qty,
        remark: dto.remark,
        workerId: dto.workerId,
        refType: 'MISC',
      },
      include: { part: true, lot: true, toWarehouse: true },
    });
  }
}
