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
import { Repository, In } from 'typeorm';
import { ShipmentOrder } from '../../../entities/shipment-order.entity';
import { ShipmentOrderItem } from '../../../entities/shipment-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ShipHistoryQueryDto } from '../dto/ship-history.dto';

@Injectable()
export class ShipHistoryService {
  constructor(
    @InjectRepository(ShipmentOrder)
    private readonly shipmentOrderRepository: Repository<ShipmentOrder>,
    @InjectRepository(ShipmentOrderItem)
    private readonly shipmentOrderItemRepository: Repository<ShipmentOrderItem>,
    @InjectRepository(ItemMaster)
    private readonly partRepository: Repository<ItemMaster>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company && { company }),
      ...(plant && { plant }),
    };
  }

  /** 출하이력 목록 조회 */
  async findAll(query: ShipHistoryQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, shipDateFrom, shipDateTo, customerName } = query;
    const skip = (page - 1) * limit;

    const buildBaseQb = () => {
      const qb = this.shipmentOrderRepository.createQueryBuilder('order');
      if (company) qb.andWhere('order.company = :company', { company });
      if (plant) qb.andWhere('order.plant = :plant', { plant });
      if (status) qb.andWhere('order.status = :status', { status });
      if (customerName) qb.andWhere('order.customerName LIKE :customerName', { customerName: `%${customerName}%` });
      if (search) qb.andWhere('order.shipOrderNo LIKE :search', { search: `%${search}%` });
      if (shipDateFrom) qb.andWhere("order.shipDate >= TO_DATE(:shipDateFrom, 'YYYY-MM-DD')", { shipDateFrom });
      if (shipDateTo) qb.andWhere("order.shipDate < TO_DATE(:shipDateTo, 'YYYY-MM-DD') + 1", { shipDateTo });
      return qb;
    };

    const [data, total] = await Promise.all([
      buildBaseQb().orderBy('order.createdAt', 'DESC').skip(skip).take(limit).getMany(),
      buildBaseQb().getCount(),
    ]);

    // 품목 정보 일괄 조회 (N+1 제거)
    const orderNos = data.map((o) => o.shipOrderNo);
    const allItems = orderNos.length > 0
      ? await this.shipmentOrderItemRepository.find({
          where: { shipOrderNo: In(orderNos), ...this.tenantWhere(company, plant) },
        })
      : [];

    const itemCodes = [...new Set(allItems.map((i) => i.itemCode).filter(Boolean))];
    const parts = itemCodes.length > 0
      ? await this.partRepository.find({
          where: { itemCode: In(itemCodes), ...this.tenantWhere(company, plant) },
          select: ['itemCode', 'itemName'],
        })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    const resultData = data.map((order) => {
      const items = allItems
        .filter((i) => i.shipOrderNo === order.shipOrderNo)
        .map((item) => ({
          ...item,
          part: partMap.get(item.itemCode) || undefined,
        }));
      return { ...order, items };
    });

    return { data: resultData, total, page, limit };
  }

  /** 출하이력 통계 요약 */
  async getSummary(company?: string, plant?: string) {
    const [total, byStatus] = await Promise.all([
      this.shipmentOrderRepository.count({ where: this.tenantWhere(company, plant) }),
      (async () => {
        const qb = this.shipmentOrderRepository
          .createQueryBuilder('order')
          .select('order.status', 'status')
          .addSelect('COUNT(*)', 'count');
        if (company) qb.where('order.company = :company', { company });
        if (plant) qb.andWhere('order.plant = :plant', { plant });
        return qb.groupBy('order.status').getRawMany();
      })(),
    ]);

    return {
      total,
      byStatus: byStatus.map((s) => ({ status: s.status, count: parseInt(s.count) })),
    };
  }
}
