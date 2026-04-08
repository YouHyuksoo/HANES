/**
 * @file src/modules/outsourcing/services/outsourcing.service.ts
 * @description 외주관리 비즈니스 로직 서비스 - TypeORM Repository 패턴
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { SubconOrder } from '../../../entities/subcon-order.entity';
import { SubconDelivery } from '../../../entities/subcon-delivery.entity';
import { SubconReceive } from '../../../entities/subcon-receive.entity';
import { VendorMaster } from '../../../entities/vendor-master.entity';
import { NumberingService } from '../../../shared/numbering.service';
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

  constructor(
    @InjectRepository(SubconOrder)
    private readonly subconOrderRepository: Repository<SubconOrder>,
    @InjectRepository(SubconDelivery)
    private readonly subconDeliveryRepository: Repository<SubconDelivery>,
    @InjectRepository(SubconReceive)
    private readonly subconReceiveRepository: Repository<SubconReceive>,
    @InjectRepository(VendorMaster)
    private readonly vendorMasterRepository: Repository<VendorMaster>,
    private readonly dataSource: DataSource,
    private readonly numbering: NumberingService,
  ) {}

  // ============================================================================
  // 외주처 마스터
  // ============================================================================

  async findAllVendors(query: VendorQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, vendorType, search, useYn } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.vendorMasterRepository
      .createQueryBuilder('vm')

    if (company) {
      queryBuilder.andWhere('vm.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('vm.plant = :plant', { plant });
    }
    if (vendorType) {
      queryBuilder.andWhere('vm.vendorType = :vendorType', { vendorType });
    }

    if (useYn) {
      queryBuilder.andWhere('vm.useYn = :useYn', { useYn });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(vm.vendorCode LIKE :search OR vm.vendorName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    const [data, total] = await Promise.all([
      queryBuilder
        .orderBy('vm.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    return { data, total, page, limit };
  }

  async findVendorById(vendorCode: string) {
    const vendor = await this.vendorMasterRepository.findOne({
      where: { vendorCode },
    });

    if (!vendor) {
      throw new NotFoundException(`외주처를 찾을 수 없습니다: ${vendorCode}`);
    }

    const subconOrders = await this.subconOrderRepository.find({
      where: { vendorId: vendorCode },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return { ...vendor, subconOrders };
  }

  async createVendor(dto: CreateVendorDto) {
    const existing = await this.vendorMasterRepository.findOne({
      where: { vendorCode: dto.vendorCode },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 외주처 코드입니다: ${dto.vendorCode}`);
    }

    const vendor = this.vendorMasterRepository.create(dto);
    return this.vendorMasterRepository.save(vendor);
  }

  async updateVendor(vendorCode: string, dto: UpdateVendorDto) {
    await this.findVendorById(vendorCode);

    await this.vendorMasterRepository.update({ vendorCode }, dto);
    return this.findVendorById(vendorCode);
  }

  async deleteVendor(vendorCode: string) {
    await this.findVendorById(vendorCode);

    await this.vendorMasterRepository.delete({ vendorCode });
    return { vendorCode };
  }

  // ============================================================================
  // 외주발주
  // ============================================================================

  async findAllOrders(query: SubconOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, vendorId, status, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.subconOrderRepository
      .createQueryBuilder('so')
      .leftJoinAndSelect(VendorMaster, 'vm', 'vm.VENDOR_CODE = so.VENDOR_ID')

    if (company) {
      queryBuilder.andWhere('so.company = :company', { company });
    }
    if (plant) {
      queryBuilder.andWhere('so.plant = :plant', { plant });
    }
    if (vendorId) {
      queryBuilder.andWhere('so.vendorId = :vendorId', { vendorId });
    }

    if (status) {
      queryBuilder.andWhere('so.status = :status', { status });
    }

    if (search) {
      const upper = search.toUpperCase();
      queryBuilder.andWhere(
        '(so.orderNo LIKE :search OR so.partCode LIKE :search OR so.partName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('so.orderDate BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const [orders, total] = await Promise.all([
      queryBuilder
        .orderBy('so.createdAt', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany(),
      queryBuilder.getCount(),
    ]);

    // IN 배치 선조회 + GROUP BY 집계로 N+1 방지
    const vendorIds = [...new Set(orders.map((o) => o.vendorId).filter(Boolean))] as const;
    const orderNos = orders.map((o) => o.orderNo);

    const [vendors, deliveryCounts, receiveCounts] = await Promise.all([
      vendorIds.length > 0
        ? this.vendorMasterRepository.find({
            where: { vendorCode: In(vendorIds) },
            select: ['vendorCode', 'vendorName'],
          })
        : Promise.resolve([]),
      orderNos.length > 0
        ? this.subconDeliveryRepository
            .createQueryBuilder('d')
            .select('d.orderNo', 'orderNo')
            .addSelect('COUNT(*)', 'cnt')
            .where('d.orderNo IN (:...orderNos)', { orderNos })
            .groupBy('d.orderNo')
            .getRawMany<{ orderNo: string; cnt: string }>()
        : Promise.resolve([]),
      orderNos.length > 0
        ? this.subconReceiveRepository
            .createQueryBuilder('r')
            .select('r.orderNo', 'orderNo')
            .addSelect('COUNT(*)', 'cnt')
            .where('r.orderNo IN (:...orderNos)', { orderNos })
            .groupBy('r.orderNo')
            .getRawMany<{ orderNo: string; cnt: string }>()
        : Promise.resolve([]),
    ]);

    const vendorMap = new Map(vendors.map((v) => [v.vendorCode, v] as const));
    const deliveryMap = new Map(deliveryCounts.map((d) => [d.orderNo, Number(d.cnt)] as const));
    const receiveMap = new Map(receiveCounts.map((r) => [r.orderNo, Number(r.cnt)] as const));

    const data = orders.map((order) => ({
      ...order,
      vendor: vendorMap.get(order.vendorId) ?? null,
      _count: {
        deliveries: deliveryMap.get(order.orderNo) ?? 0,
        receives: receiveMap.get(order.orderNo) ?? 0,
      },
    }));

    return { data, total, page, limit };
  }

  async findOrderById(orderNo: string) {
    const order = await this.subconOrderRepository.findOne({
      where: { orderNo },
    });

    if (!order) {
      throw new NotFoundException(`외주발주를 찾을 수 없습니다: ${orderNo}`);
    }

    const vendor = await this.vendorMasterRepository.findOne({
      where: { vendorCode: order.vendorId },
    });

    const deliveries = await this.subconDeliveryRepository.find({
      where: { orderNo },
      order: { createdAt: 'DESC' },
    });

    const receives = await this.subconReceiveRepository.find({
      where: { orderNo },
      order: { createdAt: 'DESC' },
    });

    return { ...order, vendor, deliveries, receives };
  }

  async createOrder(dto: CreateSubconOrderDto) {
    // 통합 채번 서비스로 발주번호 생성
    const orderNo = await this.numbering.nextSubconNo();

    const order = this.subconOrderRepository.create({
      orderNo,
      vendorId: dto.vendorId,
      partCode: dto.itemCode,
      partName: dto.itemName,
      orderQty: dto.orderQty,
      unitPrice: dto.unitPrice,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      remark: dto.remark,
    });

    return this.subconOrderRepository.save(order);
  }

  async updateOrder(orderNo: string, dto: UpdateSubconOrderDto) {
    await this.findOrderById(orderNo);

    const updateData: Partial<SubconOrder> = {};
    if (dto.itemCode !== undefined) updateData.partCode = dto.itemCode;
    if (dto.itemName !== undefined) updateData.partName = dto.itemName;
    if (dto.orderQty !== undefined) updateData.orderQty = dto.orderQty;
    if (dto.unitPrice !== undefined) updateData.unitPrice = dto.unitPrice;
    if (dto.orderDate !== undefined) updateData.orderDate = new Date(dto.orderDate);
    if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    await this.subconOrderRepository.update({ orderNo }, updateData);
    return this.findOrderById(orderNo);
  }

  async cancelOrder(orderNo: string) {
    const order = await this.findOrderById(orderNo);

    if (order.status !== 'ORDERED') {
      throw new BadRequestException('발주 상태에서만 취소할 수 있습니다.');
    }

    await this.subconOrderRepository.update({ orderNo }, { status: 'CANCELED' });
    return this.findOrderById(orderNo);
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
    const count = await this.subconDeliveryRepository.count({
      where: {
        deliveryNo: `SCD${today}%`,
      },
    });
    const deliveryNo = `SCD${today}${String(count + 1).padStart(4, '0')}`;

    return this.dataSource.transaction(async (manager) => {
      const delivery = manager.create(SubconDelivery, {
        orderNo: dto.orderId,
        deliveryNo,
        matUid: dto.matUid,
        qty: dto.qty,
        workerId: dto.workerId,
        remark: dto.remark,
      });

      await manager.save(delivery);

      // 발주 출고수량 업데이트
      const newDeliveredQty = order.deliveredQty + dto.qty;
      await manager.update(
        SubconOrder,
        { orderNo: dto.orderId },
        {
          deliveredQty: newDeliveredQty,
          status: newDeliveredQty >= order.orderQty ? 'DELIVERED' : 'ORDERED',
        },
      );

      return delivery;
    });
  }

  async findDeliveriesByOrderId(orderNo: string) {
    return this.subconDeliveryRepository.find({
      where: { orderNo },
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================================================
  // 외주 입고
  // ============================================================================

  async createReceive(dto: CreateSubconReceiveDto) {
    const order = await this.findOrderById(dto.orderId);

    // 입고번호 생성
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.subconReceiveRepository.count({
      where: {
        receiveNo: `SCR${today}%`,
      },
    });
    const receiveNo = `SCR${today}${String(count + 1).padStart(4, '0')}`;

    const goodQty = dto.goodQty ?? dto.qty;
    const defectQty = dto.defectQty ?? 0;

    return this.dataSource.transaction(async (manager) => {
      const receive = manager.create(SubconReceive, {
        orderNo: dto.orderId,
        receiveNo,
        matUid: dto.matUid,
        qty: dto.qty,
        goodQty,
        defectQty,
        inspectResult: dto.inspectResult,
        workerId: dto.workerId,
        remark: dto.remark,
      });

      await manager.save(receive);

      // 발주 입고수량 업데이트
      const newReceivedQty = order.receivedQty + dto.qty;
      const newDefectQty = order.defectQty + defectQty;

      let newStatus = order.status;
      if (newReceivedQty >= order.orderQty) {
        newStatus = 'RECEIVED';
      } else if (newReceivedQty > 0) {
        newStatus = 'PARTIAL_RECV';
      }

      await manager.update(
        SubconOrder,
        { orderNo: dto.orderId },
        {
          receivedQty: newReceivedQty,
          defectQty: newDefectQty,
          status: newStatus,
        },
      );

      return receive;
    });
  }

  async findReceivesByOrderId(orderNo: string) {
    return this.subconReceiveRepository.find({
      where: { orderNo },
      order: { createdAt: 'DESC' },
    });
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getSummary() {
    const [totalOrders, activeOrders, pendingReceive, totalVendors] = await Promise.all([
      this.subconOrderRepository.count({ where: {} }),
      this.subconOrderRepository.count({
        where: {
          status: In(['ORDERED', 'DELIVERED', 'PARTIAL_RECV']),
        },
      }),
      this.subconOrderRepository.count({
        where: {
          status: In(['DELIVERED', 'PARTIAL_RECV']),
        },
      }),
      this.vendorMasterRepository.count({ where: { useYn: 'Y' } }),
    ]);

    return {
      totalOrders,
      activeOrders,
      pendingReceive,
      totalVendors,
    };
  }

  async getVendorStock() {
    const orders = await this.subconOrderRepository.find({
      where: {
        status: In(['DELIVERED', 'PARTIAL_RECV']),
      },
    });

    // 외주처별 재고 집계
    const stockByVendor = orders.reduce((acc, order) => {
      const vendorId = order.vendorId;
      if (!acc[vendorId]) {
        acc[vendorId] = {
          vendorId,
          vendorCode: '',
          vendorName: '',
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

    // IN 배치 선조회로 N+1 방지
    const vendorIdList = Object.keys(stockByVendor);
    const vendorList = vendorIdList.length > 0
      ? await this.vendorMasterRepository.find({
          where: { vendorCode: In(vendorIdList) },
          select: ['vendorCode', 'vendorName'],
        })
      : [];
    const vendorLookup = new Map(vendorList.map((v) => [v.vendorCode, v] as const));

    for (const vid of vendorIdList) {
      const vendor = vendorLookup.get(vid);
      if (vendor) {
        stockByVendor[vid].vendorCode = vendor.vendorCode;
        stockByVendor[vid].vendorName = vendor.vendorName;
      }
    }

    return Object.values(stockByVendor);
  }
}
