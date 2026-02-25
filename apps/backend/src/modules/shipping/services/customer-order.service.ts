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
import { Repository, ILike, MoreThanOrEqual, LessThanOrEqual, And, DataSource, In } from 'typeorm';
import { CustomerOrder } from '../../../entities/customer-order.entity';
import { CustomerOrderItem } from '../../../entities/customer-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import {
  CreateCustomerOrderDto,
  UpdateCustomerOrderDto,
  CustomerOrderQueryDto,
} from '../dto/customer-order.dto';

@Injectable()
export class CustomerOrderService {
  constructor(
    @InjectRepository(CustomerOrder)
    private readonly customerOrderRepository: Repository<CustomerOrder>,
    @InjectRepository(CustomerOrderItem)
    private readonly customerOrderItemRepository: Repository<CustomerOrderItem>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** 고객발주 목록 조회 */
  async findAll(query: CustomerOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(status && { status }),
      ...(search && {
        orderNo: ILike(`%${search}%`),
      }),
      ...(dueDateFrom || dueDateTo
        ? {
            dueDate: And(
              dueDateFrom ? MoreThanOrEqual(new Date(dueDateFrom)) : undefined,
              dueDateTo ? LessThanOrEqual(new Date(dueDateTo)) : undefined
            ),
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.customerOrderRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.customerOrderRepository.count({ where }),
    ]);

    // 품목 정보 병합
    const resultData = await Promise.all(
      data.map(async (order) => {
        const items = await this.customerOrderItemRepository.find({
          where: { orderId: order.id },
        });

        const itemsWithPart = await Promise.all(
          items.map(async (item) => {
            const part = await this.partRepository.findOne({
              where: { itemCode: item.itemCode },
              select: ['itemCode', 'itemName'],
            });
            return {
              ...item,
              part: part || undefined,
            };
          })
        );

        return {
          ...order,
          items: itemsWithPart,
        };
      })
    );

    return { data: resultData, total, page, limit };
  }

  /** 고객발주 단건 조회 */
  async findById(id: string) {
    const order = await this.customerOrderRepository.findOne({
      where: { id },
    });

    if (!order) throw new NotFoundException(`고객발주를 찾을 수 없습니다: ${id}`);

    const items = await this.customerOrderItemRepository.find({
      where: { orderId: order.id },
    });

    const itemsWithPart = await Promise.all(
      items.map(async (item) => {
        const part = await this.partRepository.findOne({
          where: { itemCode: item.itemCode },
          select: ['itemCode', 'itemName'],
        });
        return {
          ...item,
          part: part || undefined,
        };
      })
    );

    return {
      ...order,
      items: itemsWithPart,
    };
  }

  /** 고객발주 생성 */
  async create(dto: CreateCustomerOrderDto) {
    const existing = await this.customerOrderRepository.findOne({
      where: { orderNo: dto.orderNo },
    });
    if (existing) throw new ConflictException(`이미 존재하는 수주번호입니다: ${dto.orderNo}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = this.customerOrderRepository.create({
        orderNo: dto.orderNo,
        customerId: dto.customerId,
        customerName: dto.customerName,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        totalAmount: dto.totalAmount,
        currency: dto.currency,
        remark: dto.remark,
        status: 'RECEIVED',
      });

      const savedOrder = await queryRunner.manager.save(order);

      // 품목 생성
      if (dto.items && dto.items.length > 0) {
        const items = dto.items.map((item) =>
          this.customerOrderItemRepository.create({
            orderId: savedOrder.id,
            itemCode: item.itemCode,
            orderQty: item.orderQty,
            shippedQty: 0,
            unitPrice: item.unitPrice,
            remark: item.remark,
          })
        );
        await queryRunner.manager.save(items);
      }

      await queryRunner.commitTransaction();

      return this.findById(savedOrder.id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 고객발주 수정 */
  async update(id: string, dto: UpdateCustomerOrderDto) {
    const order = await this.findById(id);
    if (order.status === 'CLOSED') {
      throw new BadRequestException('마감된 발주는 수정할 수 없습니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.items) {
        await queryRunner.manager.delete(CustomerOrderItem, { orderId: id });

        const items = dto.items.map((item) =>
          this.customerOrderItemRepository.create({
            orderId: id,
            itemCode: item.itemCode,
            orderQty: item.orderQty,
            shippedQty: 0,
            unitPrice: item.unitPrice,
            remark: item.remark,
          })
        );
        await queryRunner.manager.save(items);
      }

      const updateData: any = {};
      if (dto.orderNo !== undefined) updateData.orderNo = dto.orderNo;
      if (dto.customerId !== undefined) updateData.customerId = dto.customerId;
      if (dto.customerName !== undefined) updateData.customerName = dto.customerName;
      if (dto.orderDate !== undefined) updateData.orderDate = dto.orderDate ? new Date(dto.orderDate) : new Date();
      if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      if (dto.totalAmount !== undefined) updateData.totalAmount = dto.totalAmount;
      if (dto.currency !== undefined) updateData.currency = dto.currency;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.remark !== undefined) updateData.remark = dto.remark;

      await queryRunner.manager.update(CustomerOrder, { id }, updateData);

      await queryRunner.commitTransaction();

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 고객발주 삭제 */
  async delete(id: string) {
    const order = await this.findById(id);
    if (order.status !== 'RECEIVED') {
      throw new BadRequestException('접수 상태에서만 삭제할 수 있습니다.');
    }

    await this.customerOrderRepository.delete(id);

    return { id, deleted: true };
  }
}
