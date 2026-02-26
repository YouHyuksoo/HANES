/**
 * @file src/modules/material/services/po-status.service.ts
 * @description PO현황 조회 서비스 - PO와 품목을 조인하여 입고율 등 현황 제공 (TypeORM)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In } from 'typeorm';
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { PoStatusQueryDto } from '../dto/po-status.dto';

@Injectable()
export class PoStatusService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
  ) {}

  async findAll(query: PoStatusQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (status) {
      where.status = status;
    }

    if (fromDate && toDate) {
      where.orderDate = Between(new Date(fromDate), new Date(toDate));
    } else if (fromDate) {
      where.orderDate = Between(new Date(fromDate), new Date());
    }

    if (search) {
      where.poNo = Like(`%${search}%`);
    }

    const [orders, total] = await Promise.all([
      this.purchaseOrderRepository.find({
        where,
        skip,
        take: limit,
        order: { orderDate: 'DESC' },
      }),
      this.purchaseOrderRepository.count({ where }),
    ]);

    // PO 품목 정보 조회 및 입고율 계산
    const poNos = orders.map((o) => o.poNo);
    const items = await this.purchaseOrderItemRepository.find({
      where: poNos.length > 0 ? { poNo: In(poNos) } : {},
    });

    // part 정보 조회
    const itemCodes = items.map((item) => item.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? await this.partMasterRepository.find({ where: { itemCode: In(itemCodes) } })
      : [];
    const partMap = new Map(parts.map((p) => [p.itemCode, p]));

    // PO별로 품목 그룹화
    const itemsByPoNo = new Map<string, typeof items>();
    for (const item of items) {
      if (!itemsByPoNo.has(item.poNo)) {
        itemsByPoNo.set(item.poNo, []);
      }
      itemsByPoNo.get(item.poNo)!.push(item);
    }

    const data = orders.map((po) => {
      const poItems = itemsByPoNo.get(po.poNo) || [];
      const totalOrderQty = poItems.reduce((sum, item) => sum + item.orderQty, 0);
      const totalReceivedQty = poItems.reduce((sum, item) => sum + item.receivedQty, 0);
      const receiveRate = totalOrderQty > 0 ? Math.round((totalReceivedQty / totalOrderQty) * 100) : 0;

      const itemsWithPartInfo = poItems.map((item) => {
        const part = partMap.get(item.itemCode);
        return {
          ...item,
          itemCode: part?.itemCode,
          itemName: part?.itemName,
          unit: part?.unit,
          receiveRate: item.orderQty > 0 ? Math.round((item.receivedQty / item.orderQty) * 100) : 0,
        };
      });

      return {
        ...po,
        items: itemsWithPartInfo,
        totalOrderQty,
        totalReceivedQty,
        receiveRate,
      };
    });

    return { data, total, page, limit };
  }
}
