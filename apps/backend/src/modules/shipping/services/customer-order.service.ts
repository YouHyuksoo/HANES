/**
 * @file src/modules/shipping/services/customer-order.service.ts
 * @description 고객발주(Customer PO) 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 고객발주 생성/조회/수정/삭제 + 품목 관리
 * 2. **상태 흐름**: RECEIVED -> CONFIRMED -> IN_PRODUCTION -> PARTIAL_SHIP -> SHIPPED -> CLOSED
 * 3. **품목 관리**: 고객발주 생성/수정 시 items를 함께 처리
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateCustomerOrderDto,
  UpdateCustomerOrderDto,
  CustomerOrderQueryDto,
} from '../dto/customer-order.dto';

@Injectable()
export class CustomerOrderService {
  constructor(private readonly prisma: PrismaService) {}

  /** 고객발주 목록 조회 */
  async findAll(query: CustomerOrderQueryDto) {
    const { page = 1, limit = 10, search, status, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNo: { contains: search, mode: 'insensitive' as const } },
          { customerName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(dueDateFrom || dueDateTo
        ? {
            dueDate: {
              ...(dueDateFrom && { gte: new Date(dueDateFrom) }),
              ...(dueDateTo && { lte: new Date(dueDateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.customerOrder.findMany({
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
      this.prisma.customerOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 고객발주 단건 조회 */
  async findById(id: string) {
    const order = await this.prisma.customerOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: {
          include: {
            part: { select: { id: true, partCode: true, partName: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException(`고객발주를 찾을 수 없습니다: ${id}`);
    return order;
  }

  /** 고객발주 생성 */
  async create(dto: CreateCustomerOrderDto) {
    const existing = await this.prisma.customerOrder.findFirst({
      where: { orderNo: dto.orderNo, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 수주번호입니다: ${dto.orderNo}`);

    return this.prisma.customerOrder.create({
      data: {
        orderNo: dto.orderNo,
        customerId: dto.customerId,
        customerName: dto.customerName,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        totalAmount: dto.totalAmount,
        currency: dto.currency,
        remark: dto.remark,
        status: 'RECEIVED',
        items: {
          create: dto.items.map((item) => ({
            partId: item.partId,
            orderQty: item.orderQty,
            shippedQty: 0,
            unitPrice: item.unitPrice,
            remark: item.remark,
          })),
        },
      },
      include: {
        items: {
          include: {
            part: { select: { id: true, partCode: true, partName: true } },
          },
        },
      },
    });
  }

  /** 고객발주 수정 */
  async update(id: string, dto: UpdateCustomerOrderDto) {
    const order = await this.findById(id);
    if (order.status === 'CLOSED') {
      throw new BadRequestException('마감된 발주는 수정할 수 없습니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.customerOrderItem.deleteMany({ where: { orderId: id } });
        await tx.customerOrderItem.createMany({
          data: dto.items.map((item) => ({
            orderId: id,
            partId: item.partId,
            orderQty: item.orderQty,
            shippedQty: 0,
            unitPrice: item.unitPrice,
            remark: item.remark,
          })),
        });
      }

      return tx.customerOrder.update({
        where: { id },
        data: {
          ...(dto.orderNo !== undefined && { orderNo: dto.orderNo }),
          ...(dto.customerId !== undefined && { customerId: dto.customerId }),
          ...(dto.customerName !== undefined && { customerName: dto.customerName }),
          ...(dto.orderDate !== undefined && {
            orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
          }),
          ...(dto.dueDate !== undefined && {
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          }),
          ...(dto.totalAmount !== undefined && { totalAmount: dto.totalAmount }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.remark !== undefined && { remark: dto.remark }),
        },
        include: {
          items: {
            include: {
              part: { select: { id: true, partCode: true, partName: true } },
            },
          },
        },
      });
    });
  }

  /** 고객발주 삭제 (소프트 삭제) */
  async delete(id: string) {
    const order = await this.findById(id);
    if (order.status !== 'RECEIVED') {
      throw new BadRequestException('접수 상태에서만 삭제할 수 있습니다.');
    }
    return this.prisma.customerOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
