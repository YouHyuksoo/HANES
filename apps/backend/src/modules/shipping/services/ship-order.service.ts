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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike, MoreThanOrEqual, LessThanOrEqual, And, DataSource, In } from 'typeorm';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { CreateShipOrderDto, UpdateShipOrderDto, ShipOrderQueryDto } from '../dto/ship-order.dto';

@Injectable()
export class ShipOrderService {
  constructor(
    @InjectRepository(ShipmentOrder)
    private readonly shipOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(ShipmentOrderItem)
    private readonly shipOrderItemRepository: Repository<ShipmentOrderItem>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /** 출하지시 목록 조회 */
  async findAll(query: ShipOrderQueryDto) {
    const { page = 1, limit = 10, search, status, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: IsNull(),
      ...(status && { status }),
      ...(search && {
        shipOrderNo: ILike(`%${search}%`),
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
      this.shipOrderRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.shipOrderRepository.count({ where }),
    ]);

    // 품목 정보 조회 및 병합
    const resultData = await Promise.all(
      data.map(async (order) => {
        const items = await this.shipOrderItemRepository.find({
          where: { shipOrderId: order.id },
        });

        const itemsWithPart = await Promise.all(
          items.map(async (item) => {
            const part = await this.partRepository.findOne({
              where: { id: item.partId },
              select: ['id', 'partCode', 'partName'],
            });
            return {
              ...item,
              partId: part?.id ?? item.partId,
              partCode: part?.partCode,
              partName: part?.partName,
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

  /** 출하지시 단건 조회 */
  async findById(id: string) {
    const order = await this.shipOrderRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!order) throw new NotFoundException(`출하지시를 찾을 수 없습니다: ${id}`);

    const items = await this.shipOrderItemRepository.find({
      where: { shipOrderId: order.id },
    });

    const itemsWithPart = await Promise.all(
      items.map(async (item) => {
        const part = await this.partRepository.findOne({
          where: { id: item.partId },
          select: ['id', 'partCode', 'partName'],
        });
        return {
          ...item,
          partId: part?.id ?? item.partId,
          partCode: part?.partCode,
          partName: part?.partName,
        };
      })
    );

    return {
      ...order,
      items: itemsWithPart,
    };
  }

  /** 출하지시 생성 */
  async create(dto: CreateShipOrderDto) {
    const existing = await this.shipOrderRepository.findOne({
      where: { shipOrderNo: dto.shipOrderNo, deletedAt: IsNull() },
    });
    if (existing) throw new ConflictException(`이미 존재하는 출하지시 번호입니다: ${dto.shipOrderNo}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = this.shipOrderRepository.create({
        shipOrderNo: dto.shipOrderNo,
        customerId: dto.customerId,
        customerName: dto.customerName,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        shipDate: dto.shipDate ? new Date(dto.shipDate) : null,
        remark: dto.remark,
        status: 'DRAFT',
      });

      const savedOrder = await queryRunner.manager.save(order);

      // 품목 생성
      if (dto.items && dto.items.length > 0) {
        const items = dto.items.map((item) =>
          this.shipOrderItemRepository.create({
            shipOrderId: savedOrder.id,
            partId: item.partId,
            orderQty: item.orderQty,
            shippedQty: 0,
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

  /** 출하지시 수정 */
  async update(id: string, dto: UpdateShipOrderDto) {
    const order = await this.findById(id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 수정할 수 있습니다.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (dto.items) {
        await queryRunner.manager.delete(ShipmentOrderItem, { shipOrderId: id });

        const items = dto.items.map((item) =>
          this.shipOrderItemRepository.create({
            shipOrderId: id,
            partId: item.partId,
            orderQty: item.orderQty,
            shippedQty: 0,
            remark: item.remark,
          })
        );
        await queryRunner.manager.save(items);
      }

      const updateData: any = {};
      if (dto.shipOrderNo !== undefined) updateData.shipOrderNo = dto.shipOrderNo;
      if (dto.customerId !== undefined) updateData.customerId = dto.customerId;
      if (dto.customerName !== undefined) updateData.customerName = dto.customerName;
      if (dto.dueDate !== undefined) updateData.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      if (dto.shipDate !== undefined) updateData.shipDate = dto.shipDate ? new Date(dto.shipDate) : null;
      if (dto.status !== undefined) updateData.status = dto.status;
      if (dto.remark !== undefined) updateData.remark = dto.remark;

      await queryRunner.manager.update(ShipmentOrder, { id }, updateData);

      await queryRunner.commitTransaction();

      return this.findById(id);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 출하지시 삭제 (소프트 삭제) */
  async delete(id: string) {
    const order = await this.findById(id);
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('DRAFT 상태에서만 삭제할 수 있습니다.');
    }

    await this.shipOrderRepository.update(
      { id },
      { deletedAt: new Date() }
    );

    return { id, deleted: true };
  }
}
