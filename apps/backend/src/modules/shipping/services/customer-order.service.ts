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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CustomerOrder } from '../../../entities/customer-order.entity';
import { CustomerOrderItem } from '../../../entities/customer-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import {
  CreateCustomerOrderDto,
  UpdateCustomerOrderDto,
  CustomerOrderQueryDto,
} from '../dto/customer-order.dto';
import { TransactionService } from '../../../shared/transaction.service';
import { parseDateStart } from '../../../shared/date.util';

@Injectable()
export class CustomerOrderService {
  constructor(
    @InjectRepository(CustomerOrder)
    private readonly customerOrderRepository: Repository<CustomerOrder>,
    @InjectRepository(CustomerOrderItem)
    private readonly customerOrderItemRepository: Repository<CustomerOrderItem>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
    private readonly tx: TransactionService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  private buildCustomerOrderUpdate(
    dto: Omit<UpdateCustomerOrderDto, 'items' | 'status' | 'orderNo'>,
  ): Partial<Pick<CustomerOrder, 'customerId' | 'customerName' | 'orderDate' | 'dueDate' | 'totalAmount' | 'currency' | 'remark'>> {
    return {
      ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
      ...(dto.customerName !== undefined ? { customerName: dto.customerName } : {}),
      ...(dto.orderDate !== undefined ? { orderDate: dto.orderDate ? parseDateStart(dto.orderDate) : new Date() } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: parseDateStart(dto.dueDate) } : {}),
      ...(dto.totalAmount !== undefined ? { totalAmount: dto.totalAmount } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
      ...(dto.remark !== undefined ? { remark: dto.remark } : {}),
    };
  }

  /** 고객발주 목록 조회 */
  async findAll(query: CustomerOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const qb = this.customerOrderRepository.createQueryBuilder('co');
    if (company) qb.andWhere('co.company = :company', { company });
    if (plant) qb.andWhere('co.plant = :plant', { plant });
    if (status) qb.andWhere('co.status = :status', { status });
    if (search) qb.andWhere('co.orderNo LIKE :search', { search: `%${search}%` });
    if (dueDateFrom) qb.andWhere("co.dueDate >= TO_DATE(:dueDateFrom, 'YYYY-MM-DD')", { dueDateFrom });
    if (dueDateTo) qb.andWhere("co.dueDate < TO_DATE(:dueDateTo, 'YYYY-MM-DD') + 1", { dueDateTo });

    qb.orderBy('co.createdAt', 'DESC').skip(skip).take(limit);

    const [data, total] = await Promise.all([
      qb.getMany(),
      qb.clone().skip(0).take(undefined).getCount(),
    ]);

    // 품목 정보 병합 — IN 배치 선조회로 N+1 방지
    const orderNos = data.map((o) => o.orderNo);
    const allItems = orderNos.length > 0
      ? await this.customerOrderItemRepository.find({ where: { orderNo: In(orderNos), ...this.tenantWhere(company, plant) } })
      : [];

    const allItemCodes = [...new Set(allItems.map((i) => i.itemCode).filter(Boolean))] as const;
    const allParts = allItemCodes.length > 0
      ? await this.partRepository.find({
          where: { itemCode: In(allItemCodes), ...this.tenantWhere(company, plant) },
          select: ['itemCode', 'itemName'],
        })
      : [];
    const partMap = new Map(allParts.map((p) => [p.itemCode, p] as const));

    const itemsByOrder = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const list = itemsByOrder.get(item.orderNo) ?? [];
      list.push(item);
      itemsByOrder.set(item.orderNo, list);
    }

    const resultData = data.map((order) => {
      const items = itemsByOrder.get(order.orderNo) ?? [];
      const itemsWithPart = items.map((item) => ({
        ...item,
        part: partMap.get(item.itemCode) || undefined,
      }));
      return { ...order, id: order.orderNo, items: itemsWithPart };
    });

    return { data: resultData, total, page, limit };
  }

  async findStatus(query: CustomerOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 5000, status } = query;
    const source = await this.findAll({ ...query, page: 1, limit: Math.max(limit, 5000), status: undefined }, company, plant);
    const now = new Date();
    const rows = source.data.map((order) => {
      const items = order.items ?? [];
      const orderQty = items.reduce((sum, item) => sum + (Number(item.orderQty) || 0), 0);
      const shippedQty = items.reduce((sum, item) => sum + (Number(item.shippedQty) || 0), 0);
      const remainQty = Math.max(0, orderQty - shippedQty);
      let derivedStatus = 'IN_PROGRESS';
      if (orderQty > 0 && shippedQty >= orderQty) derivedStatus = 'COMPLETED';
      else if (shippedQty > 0) derivedStatus = 'PARTIAL_SHIP';
      else if (order.dueDate && new Date(order.dueDate) < now) derivedStatus = 'OVERDUE';

      return {
        id: order.orderNo,
        orderNo: order.orderNo,
        customerName: order.customerName,
        orderDate: order.orderDate,
        dueDate: order.dueDate,
        orderQty,
        shippedQty,
        shipRate: orderQty > 0 ? Math.round((shippedQty / orderQty) * 100) : 0,
        remainQty,
        status: derivedStatus,
      };
    });
    const filtered = status ? rows.filter((row) => row.status === status) : rows;
    const start = (page - 1) * limit;
    return {
      data: filtered.slice(start, start + limit),
      total: filtered.length,
      page,
      limit,
    };
  }

  /** 고객발주 단건 조회 */
  async findById(orderNo: string, company?: string, plant?: string) {
    const order = await this.customerOrderRepository.findOne({
      where: { orderNo, ...this.tenantWhere(company, plant) },
    });

    if (!order) throw new NotFoundException(`고객발주를 찾을 수 없습니다: ${orderNo}`);

    const items = await this.customerOrderItemRepository.find({
      where: { orderNo: order.orderNo, ...this.tenantWhere(company, plant) },
    });

    const itemCodes = [...new Set(items.map((i) => i.itemCode).filter(Boolean))] as const;
    const parts = itemCodes.length > 0
      ? await this.partRepository.find({
          where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) },
          select: ['itemCode', 'itemName'],
        })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p] as const));

    const itemsWithPart = items.map((item) => ({
      ...item,
      part: partMap.get(item.itemCode) || undefined,
    }));

    return {
      ...order,
      id: order.orderNo,
      items: itemsWithPart,
    };
  }

  /** 고객발주 생성 */
  async create(dto: CreateCustomerOrderDto, company?: string, plant?: string) {
    const existing = await this.customerOrderRepository.findOne({
      where: { orderNo: dto.orderNo, ...this.tenantWhere(company, plant) },
    });
    if (existing) throw new ConflictException(`이미 존재하는 수주번호입니다: ${dto.orderNo}`);

    let savedOrderNo!: string;
    await this.tx.run(async (queryRunner) => {
      const order = this.customerOrderRepository.create({
        orderNo: dto.orderNo,
        customerId: dto.customerId,
        customerName: dto.customerName,
        orderDate: dto.orderDate ? parseDateStart(dto.orderDate) : new Date(),
        dueDate: parseDateStart(dto.dueDate),
        totalAmount: dto.totalAmount,
        currency: dto.currency,
        remark: dto.remark,
        status: 'RECEIVED',
        company: company || null,
        plant: plant || null,
      });

      const savedOrder = await queryRunner.manager.save(order);
      savedOrderNo = savedOrder.orderNo;

      // 품목 생성
      if (dto.items && dto.items.length > 0) {
        const items = dto.items.map((item, idx) =>
          this.customerOrderItemRepository.create({
            orderNo: savedOrder.orderNo,
            seq: idx + 1,
            itemCode: item.itemCode,
            orderQty: item.orderQty,
            shippedQty: 0,
            unitPrice: item.unitPrice,
            remark: item.remark,
            company: company || null,
            plant: plant || null,
          })
        );
        await queryRunner.manager.save(items);
      }
    });

    return this.findById(savedOrderNo, company, plant);
  }

  /** 고객발주 수정 */
  async update(orderNo: string, dto: UpdateCustomerOrderDto, company?: string, plant?: string) {
    const order = await this.findById(orderNo, company, plant);
    if (order.status === 'CLOSED') {
      throw new BadRequestException('마감된 발주는 수정할 수 없습니다.');
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        `고객오더 상태(${dto.status})는 직접 변경할 수 없습니다. 고객오더 전용 상태처리 API를 사용해 주세요.`,
      );
    }
    if (dto.orderNo !== undefined && dto.orderNo !== orderNo) {
      throw new BadRequestException('고객발주 번호는 수정할 수 없습니다.');
    }

    await this.tx.run(async (queryRunner) => {
      const { items, status: _ignoredStatus, orderNo: _ignoredOrderNo, ...orderData } = dto;
      if (dto.items) {
        await queryRunner.manager.delete(CustomerOrderItem, { orderNo, ...this.tenantWhere(company, plant) });

        const itemEntities = dto.items.map((item, idx) =>
          this.customerOrderItemRepository.create({
            orderNo,
            seq: idx + 1,
            itemCode: item.itemCode,
            orderQty: item.orderQty,
            shippedQty: 0,
            unitPrice: item.unitPrice,
            remark: item.remark,
            company: company || null,
            plant: plant || null,
          })
        );
        await queryRunner.manager.save(itemEntities);
      }

      const updateData = this.buildCustomerOrderUpdate(orderData);

      if (Object.keys(updateData).length > 0) {
        await queryRunner.manager.update(CustomerOrder, { orderNo, ...this.tenantWhere(company, plant) }, updateData);
      }
    });

    return this.findById(orderNo, company, plant);
  }

  /** 고객발주 삭제 */
  async delete(orderNo: string, company?: string, plant?: string) {
    const order = await this.findById(orderNo, company, plant);
    if (order.status !== 'RECEIVED') {
      throw new BadRequestException('접수 상태에서만 삭제할 수 있습니다.');
    }

    await this.customerOrderRepository.delete({ orderNo, ...this.tenantWhere(company, plant) });

    return { orderNo, deleted: true };
  }
}
