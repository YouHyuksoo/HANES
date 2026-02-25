/**
 * @file src/modules/shipping/services/ship-history.service.ts
 * @description 출하이력 조회 전용 서비스
 *
 * 초보자 가이드:
 * 1. ShipmentOrder 테이블에서 출하 이력을 조회
 * 2. 조회 전용 (CRUD 없음)
 * 3. 다양한 필터링 (상태, 날짜, 고객명 등) 지원
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, MoreThanOrEqual, LessThanOrEqual, And } from 'typeorm';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ShipHistoryQueryDto } from '../dto/ship-history.dto';

@Injectable()
export class ShipHistoryService {
  constructor(
    @InjectRepository(ShipmentOrder)
    private readonly shipmentOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(ShipmentOrderItem)
    private readonly shipmentOrderItemRepository: Repository<ShipmentOrderItem>,
    @InjectRepository(PartMaster)
    private readonly partRepository: Repository<PartMaster>,
  ) {}

  /** 출하이력 목록 조회 */
  async findAll(query: ShipHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, shipDateFrom, shipDateTo, customerName } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
      ...(status && { status }),
      ...(customerName && { customerName: ILike(`%${customerName}%`) }),
      ...(search && {
        shipOrderNo: ILike(`%${search}%`),
      }),
      ...(shipDateFrom || shipDateTo
        ? {
            shipDate: And(
              shipDateFrom ? MoreThanOrEqual(new Date(shipDateFrom)) : undefined,
              shipDateTo ? LessThanOrEqual(new Date(shipDateTo)) : undefined
            ),
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.shipmentOrderRepository.find({
        where,
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      }),
      this.shipmentOrderRepository.count({ where }),
    ]);

    // 품목 정보 병합
    const resultData = await Promise.all(
      data.map(async (order) => {
        const items = await this.shipmentOrderItemRepository.find({
          where: { shipOrderId: order.id },
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

  /** 출하이력 통계 요약 */
  async getSummary() {
    const [total, byStatus] = await Promise.all([
      this.shipmentOrderRepository.count({ where: {} }),
      this.shipmentOrderRepository
        .createQueryBuilder('order')
        .select('order.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('order.status')
        .getRawMany(),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: parseInt(s.count) })),
    };
  }
}
