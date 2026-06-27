/**
 * @file src/modules/material/services/po-status.service.ts
 * @description PO현황 조회 서비스 - PO와 품목을 조인하여 입고율 등 현황 제공 (TypeORM)
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, Like, In, FindOptionsWhere } from 'typeorm';

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
import { PurchaseOrder } from '../../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../../entities/purchase-order-item.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { PoStatusQueryDto } from '../dto/po-status.dto';
import { parseDateStart, parseDateEnd } from '../../../shared/date.util';

@Injectable()
export class PoStatusService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly purchaseOrderRepository: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private readonly purchaseOrderItemRepository: Repository<PurchaseOrderItem>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
  ) {}

  async findAll(query: PoStatusQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 10, search, status, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<PurchaseOrder> = {
      ...(company && { company }),
      ...(plant && { plant }),
    };

    if (status) {
      where.status = status;
    }

    if (fromDate && toDate) {
      where.orderDate = Between(parseDateStart(fromDate)!, parseDateEnd(toDate)!);
    } else if (fromDate) {
      where.orderDate = Between(parseDateStart(fromDate)!, new Date());
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
    const tenantWhere = {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
    const items = poNos.length > 0
      ? (await Promise.all(
          chunkArray(poNos, 999).map((chunk) =>
            this.purchaseOrderItemRepository.find({ where: { poNo: In(chunk), ...tenantWhere } }),
          ),
        )).flat()
      : await this.purchaseOrderItemRepository.find({ where: tenantWhere });

    // part 정보 조회
    const itemCodes = items.map((item) => item.itemCode).filter(Boolean);
    const parts = itemCodes.length > 0
      ? (await Promise.all(
          chunkArray(itemCodes, 999).map((chunk) =>
            this.itemMasterRepository.find({ where: { itemCode: In(chunk), ...tenantWhere } }),
          ),
        )).flat()
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
          itemCode: item.itemCode,
          itemName: part?.itemName ?? null,
          spec: part?.spec ?? null,
          unit: part?.unit ?? null,
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
