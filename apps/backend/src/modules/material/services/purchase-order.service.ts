/**
 * @file src/modules/material/services/purchase-order.service.ts
 * @description 구매발주(PO) 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **PO 생성**: 품목 목록과 함께 PO 생성 (트랜잭션 처리)
 * 2. **PO 확정**: DRAFT -> CONFIRMED 상태 변경
 * 3. **금액 계산**: 품목별 수량 x 단가 합산
 */

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePurchaseOrderDto, UpdatePurchaseOrderDto, PurchaseOrderQueryDto } from '../dto/purchase-order.dto';

@Injectable()
export class PurchaseOrderService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PurchaseOrderQueryDto) {
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
          items: { include: { part: { select: { id: true, partCode: true, partName: true, unit: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { include: { part: { select: { id: true, partCode: true, partName: true, unit: true } } } },
      },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${id}`);
    return po;
  }

  async create(dto: CreatePurchaseOrderDto) {
    const existing = await this.prisma.purchaseOrder.findFirst({
      where: { poNo: dto.poNo, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 PO 번호입니다: ${dto.poNo}`);

    const totalAmount = dto.items.reduce((sum, item) => {
      return sum + (item.orderQty * (item.unitPrice ?? 0));
    }, 0);

    return this.prisma.purchaseOrder.create({
      data: {
        poNo: dto.poNo,
        partnerId: dto.partnerId,
        partnerName: dto.partnerName,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        remark: dto.remark,
        totalAmount,
        items: {
          create: dto.items.map((item) => ({
            partId: item.partId,
            orderQty: item.orderQty,
            unitPrice: item.unitPrice,
            remark: item.remark,
          })),
        },
      },
      include: { items: { include: { part: true } } },
    });
  }

  async update(id: string, dto: UpdatePurchaseOrderDto) {
    await this.findById(id);
    const { items, ...poData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseOrderItem.deleteMany({ where: { poId: id } });
        const totalAmount = items.reduce((sum, item) => sum + (item.orderQty * (item.unitPrice ?? 0)), 0);
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            ...poData,
            ...(poData.orderDate && { orderDate: new Date(poData.orderDate) }),
            ...(poData.dueDate && { dueDate: new Date(poData.dueDate) }),
            totalAmount,
            items: {
              create: items.map((item) => ({
                partId: item.partId,
                orderQty: item.orderQty,
                unitPrice: item.unitPrice,
                remark: item.remark,
              })),
            },
          },
        });
      } else {
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            ...poData,
            ...(poData.orderDate && { orderDate: new Date(poData.orderDate) }),
            ...(poData.dueDate && { dueDate: new Date(poData.dueDate) }),
          },
        });
      }

      return this.findById(id);
    });
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
