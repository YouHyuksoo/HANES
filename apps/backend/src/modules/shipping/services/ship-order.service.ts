/**
 * @file src/modules/shipping/services/ship-order.service.ts
 * @description 출하지시 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 출하지시 생성/조회/수정/삭제 + 품목 관리
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> SHIPPING -> SHIPPED
 * 3. **품목 관리**: 출하지시 생성/수정 시 items를 함께 처리
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateShipOrderDto, UpdateShipOrderDto, ShipOrderQueryDto } from '../dto/ship-order.dto';

@Injectable()
export class ShipOrderService {
  constructor(private readonly prisma: PrismaService) {}

  /** 출하지시 목록 조회 */
  async findAll(query: ShipOrderQueryDto) {
    const { page = 1, limit = 10, search, status, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { shipOrderNo: { contains: search, mode: 'insensitive' as const } },
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
      this.prisma.shipmentOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { part: { select: { id: true, partCode: true, partName: true } } } },
        },
      }),
      this.prisma.shipmentOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 출하지시 단건 조회 */
  async findById(id: string) {
    const order = await this.prisma.shipmentOrder.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: { include: { part: { select: { id: true, partCode: true, partName: true } } } },
      },
    });
    if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${id}`);
    return order;
  }

  /** 출하지시 생성 */
  async create(dto: CreateShipOrderDto) {
    const existing = await this.prisma.shipmentOrder.findFirst({
      where: { shipOrderNo: dto.shipOrderNo, deletedAt: null },
    });
    if (existing) throw new ConflictException(`이미 존재하는 출하지시 번호입니다: ${dto.shipOrderNo}`);

    return this.prisma.shipmentOrder.create({
      data: {
        shipOrderNo: dto.shipOrderNo,
        customerId: dto.customerId,
        customerName: dto.customerName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        shipDate: dto.shipDate ? new Date(dto.shipDate) : null,
        remark: dto.remark,
        status: 'DRAFT',
        items: {
          create: dto.items.map((item) => ({
            partId: item.partId,
            orderQty: item.orderQty,
            shippedQty: 0,
            remark: item.remark,
          })),
        },
      },
      include: {
        items: { include: { part: { select: { id: true, partCode: true, partName: true } } } },
      },
    });
  }

  /** 출하지시 수정 */
  async update(id: string, dto: UpdateShipOrderDto) {
    const order = await this.findById(id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 수정할 수 있습니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.shipmentOrderItem.deleteMany({ where: { shipOrderId: id } });
        await tx.shipmentOrderItem.createMany({
          data: dto.items.map((item) => ({
            shipOrderId: id,
            partId: item.partId,
            orderQty: item.orderQty,
            shippedQty: 0,
            remark: item.remark,
          })),
        });
      }

      return tx.shipmentOrder.update({
        where: { id },
        data: {
          ...(dto.shipOrderNo !== undefined && { shipOrderNo: dto.shipOrderNo }),
          ...(dto.customerId !== undefined && { customerId: dto.customerId }),
          ...(dto.customerName !== undefined && { customerName: dto.customerName }),
          ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ? new Date(dto.dueDate) : null }),
          ...(dto.shipDate !== undefined && { shipDate: dto.shipDate ? new Date(dto.shipDate) : null }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.remark !== undefined && { remark: dto.remark }),
        },
        include: {
          items: { include: { part: { select: { id: true, partCode: true, partName: true } } } },
        },
      });
    });
  }

  /** 출하지시 삭제 (소프트 삭제) */
  async delete(id: string) {
    const order = await this.findById(id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 삭제할 수 있습니다.');
    }
    return this.prisma.shipmentOrder.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
