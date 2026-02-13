/**
 * @file src/modules/material/services/receipt-cancel.service.ts
 * @description 입고취소 비즈니스 로직 - StockTransaction 역분개 처리
 *
 * 초보자 가이드:
 * 1. **역분개**: 원래 입고 트랜잭션의 반대 트랜잭션을 생성
 * 2. **cancelRefId**: 역분개 트랜잭션은 원본 ID를 참조
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReceiptCancelDto, ReceiptCancelQueryDto } from '../dto/receipt-cancel.dto';

@Injectable()
export class ReceiptCancelService {
  constructor(private readonly prisma: PrismaService) {}

  /** 취소 가능한 입고 트랜잭션 목록 */
  async findCancellable(query: ReceiptCancelQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      transType: { in: ['MAT_IN', 'MISC_IN'] },
      status: 'DONE',
      ...(search && {
        OR: [
          { transNo: { contains: search, mode: 'insensitive' as const } },
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

  /** 입고 취소 (역분개) */
  async cancel(dto: CreateReceiptCancelDto) {
    const original = await this.prisma.stockTransaction.findFirst({
      where: { id: dto.transactionId },
    });
    if (!original) throw new NotFoundException(`트랜잭션을 찾을 수 없습니다: ${dto.transactionId}`);
    if (original.status === 'CANCELED') throw new BadRequestException('이미 취소된 트랜잭션입니다.');

    const cancelTransNo = `${original.transNo}-C`;

    return this.prisma.$transaction(async (tx) => {
      await tx.stockTransaction.update({
        where: { id: dto.transactionId },
        data: { status: 'CANCELED' },
      });

      const cancelTx = await tx.stockTransaction.create({
        data: {
          transNo: cancelTransNo,
          transType: `${original.transType}_CANCEL`,
          fromWarehouseId: original.toWarehouseId,
          toWarehouseId: original.fromWarehouseId,
          partId: original.partId,
          lotId: original.lotId,
          qty: -original.qty,
          remark: dto.reason,
          workerId: dto.workerId,
          cancelRefId: original.id,
          refType: 'CANCEL',
        },
        include: { part: true, lot: true },
      });

      if (original.lotId) {
        const lot = await tx.lot.findFirst({ where: { id: original.lotId } });
        if (lot) {
          await tx.lot.update({
            where: { id: original.lotId },
            data: { currentQty: Math.max(0, lot.currentQty - original.qty) },
          });
        }
      }

      return cancelTx;
    });
  }
}
