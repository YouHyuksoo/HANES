/**
 * @file src/modules/outsourcing/services/outsourcing.service.ts
 * @description 외주관리 비즈니스 로직 서비스
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  VendorQueryDto,
  CreateSubconOrderDto,
  UpdateSubconOrderDto,
  SubconOrderQueryDto,
  CreateSubconDeliveryDto,
  CreateSubconReceiveDto,
} from '../dto/outsourcing.dto';

@Injectable()
export class OutsourcingService {
  private readonly logger = new Logger(OutsourcingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 외주처 마스터
  // ============================================================================

  async findAllVendors(query: VendorQueryDto) {
    const { page = 1, limit = 10, vendorType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(vendorType && { vendorType }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { vendorCode: { contains: search, mode: 'insensitive' as const } },
          { vendorName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.vendorMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.vendorMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findVendorById(id: string) {
    const vendor = await this.prisma.vendorMaster.findUnique({
      where: { id },
      include: {
        subconOrders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException(`외주처를 찾을 수 없습니다: ${id}`);
    }

    return vendor;
  }

  async createVendor(dto: CreateVendorDto) {
    const existing = await this.prisma.vendorMaster.findUnique({
      where: { vendorCode: dto.vendorCode },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 외주처 코드입니다: ${dto.vendorCode}`);
    }

    return this.prisma.vendorMaster.create({
      data: dto,
    });
  }

  async updateVendor(id: string, dto: UpdateVendorDto) {
    await this.findVendorById(id);

    return this.prisma.vendorMaster.update({
      where: { id },
      data: dto,
    });
  }

  async deleteVendor(id: string) {
    await this.findVendorById(id);

    return this.prisma.vendorMaster.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================================================
  // 외주발주
  // ============================================================================

  async findAllOrders(query: SubconOrderQueryDto) {
    const { page = 1, limit = 10, vendorId, status, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(vendorId && { vendorId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNo: { contains: search, mode: 'insensitive' as const } },
          { partCode: { contains: search, mode: 'insensitive' as const } },
          { partName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(startDate && endDate && {
        orderDate: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.subconOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vendor: {
            select: {
              vendorCode: true,
              vendorName: true,
            },
          },
          _count: {
            select: {
              deliveries: true,
              receives: true,
            },
          },
        },
      }),
      this.prisma.subconOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOrderById(id: string) {
    const order = await this.prisma.subconOrder.findUnique({
      where: { id },
      include: {
        vendor: true,
        deliveries: {
          orderBy: { createdAt: 'desc' },
        },
        receives: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`외주발주를 찾을 수 없습니다: ${id}`);
    }

    return order;
  }

  async createOrder(dto: CreateSubconOrderDto) {
    // 발주번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.subconOrder.count({
      where: {
        orderNo: { startsWith: `SCO${today}` },
      },
    });
    const orderNo = `SCO${today}${String(count + 1).padStart(4, '0')}`;

    return this.prisma.subconOrder.create({
      data: {
        orderNo,
        vendorId: dto.vendorId,
        partCode: dto.partCode,
        partName: dto.partName,
        orderQty: dto.orderQty,
        unitPrice: dto.unitPrice,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        remark: dto.remark,
      },
    });
  }

  async updateOrder(id: string, dto: UpdateSubconOrderDto) {
    await this.findOrderById(id);

    return this.prisma.subconOrder.update({
      where: { id },
      data: {
        ...(dto.partCode !== undefined && { partCode: dto.partCode }),
        ...(dto.partName !== undefined && { partName: dto.partName }),
        ...(dto.orderQty !== undefined && { orderQty: dto.orderQty }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.orderDate !== undefined && { orderDate: new Date(dto.orderDate) }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
      },
    });
  }

  async cancelOrder(id: string) {
    const order = await this.findOrderById(id);

    if (order.status !== 'ORDERED') {
      throw new BadRequestException('발주 상태에서만 취소할 수 있습니다.');
    }

    return this.prisma.subconOrder.update({
      where: { id },
      data: { status: 'CANCELED' },
    });
  }

  // ============================================================================
  // 외주 출고
  // ============================================================================

  async createDelivery(dto: CreateSubconDeliveryDto) {
    const order = await this.findOrderById(dto.orderId);

    // 출고 가능 수량 확인
    const remainQty = order.orderQty - order.deliveredQty;
    if (dto.qty > remainQty) {
      throw new BadRequestException(`출고 가능 수량(${remainQty})을 초과했습니다.`);
    }

    // 출고번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.subconDelivery.count({
      where: {
        deliveryNo: { startsWith: `SCD${today}` },
      },
    });
    const deliveryNo = `SCD${today}${String(count + 1).padStart(4, '0')}`;

    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.subconDelivery.create({
        data: {
          orderId: dto.orderId,
          deliveryNo,
          lotNo: dto.lotNo,
          qty: dto.qty,
          workerId: dto.workerId,
          remark: dto.remark,
        },
      });

      // 발주 출고수량 업데이트
      const newDeliveredQty = order.deliveredQty + dto.qty;
      await tx.subconOrder.update({
        where: { id: dto.orderId },
        data: {
          deliveredQty: newDeliveredQty,
          status: newDeliveredQty >= order.orderQty ? 'DELIVERED' : 'ORDERED',
        },
      });

      return delivery;
    });
  }

  async findDeliveriesByOrderId(orderId: string) {
    return this.prisma.subconDelivery.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================================
  // 외주 입고
  // ============================================================================

  async createReceive(dto: CreateSubconReceiveDto) {
    const order = await this.findOrderById(dto.orderId);

    // 입고번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.subconReceive.count({
      where: {
        receiveNo: { startsWith: `SCR${today}` },
      },
    });
    const receiveNo = `SCR${today}${String(count + 1).padStart(4, '0')}`;

    const goodQty = dto.goodQty ?? dto.qty;
    const defectQty = dto.defectQty ?? 0;

    return this.prisma.$transaction(async (tx) => {
      const receive = await tx.subconReceive.create({
        data: {
          orderId: dto.orderId,
          receiveNo,
          lotNo: dto.lotNo,
          qty: dto.qty,
          goodQty,
          defectQty,
          inspectResult: dto.inspectResult,
          workerId: dto.workerId,
          remark: dto.remark,
        },
      });

      // 발주 입고수량 업데이트
      const newReceivedQty = order.receivedQty + dto.qty;
      const newDefectQty = order.defectQty + defectQty;

      let newStatus = order.status;
      if (newReceivedQty >= order.orderQty) {
        newStatus = 'RECEIVED';
      } else if (newReceivedQty > 0) {
        newStatus = 'PARTIAL_RECV';
      }

      await tx.subconOrder.update({
        where: { id: dto.orderId },
        data: {
          receivedQty: newReceivedQty,
          defectQty: newDefectQty,
          status: newStatus,
        },
      });

      return receive;
    });
  }

  async findReceivesByOrderId(orderId: string) {
    return this.prisma.subconReceive.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getSummary() {
    const [totalOrders, activeOrders, pendingReceive, totalVendors] = await Promise.all([
      this.prisma.subconOrder.count({ where: { deletedAt: null } }),
      this.prisma.subconOrder.count({
        where: { status: { in: ['ORDERED', 'DELIVERED', 'PARTIAL_RECV'] }, deletedAt: null },
      }),
      this.prisma.subconOrder.count({
        where: { status: { in: ['DELIVERED', 'PARTIAL_RECV'] }, deletedAt: null },
      }),
      this.prisma.vendorMaster.count({ where: { useYn: 'Y', deletedAt: null } }),
    ]);

    return {
      totalOrders,
      activeOrders,
      pendingReceive,
      totalVendors,
    };
  }

  async getVendorStock() {
    const orders = await this.prisma.subconOrder.findMany({
      where: {
        status: { in: ['DELIVERED', 'PARTIAL_RECV'] },
        deletedAt: null,
      },
      include: {
        vendor: {
          select: {
            vendorCode: true,
            vendorName: true,
          },
        },
      },
    });

    // 외주처별 재고 집계
    const stockByVendor = orders.reduce((acc, order) => {
      const vendorId = order.vendorId;
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendorId,
          vendorCode: order.vendor.vendorCode,
          vendorName: order.vendor.vendorName,
          deliveredQty: 0,
          receivedQty: 0,
          stockQty: 0,
        };
      }
      acc[vendorId].deliveredQty += order.deliveredQty;
      acc[vendorId].receivedQty += order.receivedQty;
      acc[vendorId].stockQty += order.deliveredQty - order.receivedQty;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(stockByVendor);
  }
}
