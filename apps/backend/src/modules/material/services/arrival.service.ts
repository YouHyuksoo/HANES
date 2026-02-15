/**
 * @file src/modules/material/services/arrival.service.ts
 * @description 입하관리 비즈니스 로직 - PO 기반/수동 입하 및 역분개 취소
 *
 * 초보자 가이드:
 * 1. **PO 입하**: PurchaseOrder 기반 분할 입하 (receivedQty 누적, PO status 재계산)
 * 2. **수동 입하**: PO 없이 직접 입하 등록
 * 3. **입하 취소**: 역분개 방식 (원본 CANCELED + 반대 트랜잭션 생성)
 * 4. **Stock upsert**: 입하 시 Stock 테이블 현재고 업데이트
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreatePoArrivalDto,
  CreateManualArrivalDto,
  ArrivalQueryDto,
  CancelArrivalDto,
} from '../dto/arrival.dto';

@Injectable()
export class ArrivalService {
  constructor(private readonly prisma: PrismaService) {}

  /** 입하 가능 PO 목록 조회 (CONFIRMED/PARTIAL 상태) */
  async findReceivablePOs() {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: {
        status: { in: ['CONFIRMED', 'PARTIAL'] },
        deletedAt: null,
      },
      include: {
        items: {
          include: {
            part: { select: { id: true, partCode: true, partName: true, unit: true } },
          },
        },
      },
      orderBy: { orderDate: 'desc' },
    });

    return pos.map((po) => ({
      ...po,
      items: po.items.map((item) => ({
        ...item,
        remainingQty: item.orderQty - item.receivedQty,
      })),
      totalOrderQty: po.items.reduce((sum, i) => sum + i.orderQty, 0),
      totalReceivedQty: po.items.reduce((sum, i) => sum + i.receivedQty, 0),
      totalRemainingQty: po.items.reduce((sum, i) => sum + (i.orderQty - i.receivedQty), 0),
    }));
  }

  /** 특정 PO의 입하 가능 품목 조회 */
  async getPoItems(poId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: poId, deletedAt: null },
      include: {
        items: {
          include: {
            part: { select: { id: true, partCode: true, partName: true, unit: true } },
          },
        },
      },
    });

    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${poId}`);

    return {
      ...po,
      items: po.items
        .map((item) => ({
          ...item,
          remainingQty: item.orderQty - item.receivedQty,
        }))
        .filter((item) => item.remainingQty > 0),
    };
  }

  /** PO 기반 입하 등록 (핵심 트랜잭션) */
  async createPoArrival(dto: CreatePoArrivalDto) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: dto.poId, deletedAt: null },
      include: { items: true },
    });
    if (!po) throw new NotFoundException(`PO를 찾을 수 없습니다: ${dto.poId}`);
    if (!['CONFIRMED', 'PARTIAL'].includes(po.status)) {
      throw new BadRequestException(`입하 불가 상태입니다: ${po.status}`);
    }

    // 잔량 검증
    for (const item of dto.items) {
      const poItem = po.items.find((pi) => pi.id === item.poItemId);
      if (!poItem) throw new BadRequestException(`PO 품목을 찾을 수 없습니다: ${item.poItemId}`);
      const remaining = poItem.orderQty - poItem.receivedQty;
      if (item.receivedQty > remaining) {
        throw new BadRequestException(
          `입하수량(${item.receivedQty})이 잔량(${remaining})을 초과합니다.`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of dto.items) {
        const transNo = `ARR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
        const lotNo = item.lotNo || `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

        // 1. LOT 생성
        const lot = await tx.lot.create({
          data: {
            lotNo,
            partId: item.partId,
            partType: 'RAW',
            initQty: item.receivedQty,
            currentQty: item.receivedQty,
            recvDate: new Date(),
            poNo: po.poNo,
            vendor: po.partnerName,
          },
        });

        // 2. StockTransaction 생성
        const stockTx = await tx.stockTransaction.create({
          data: {
            transNo,
            transType: 'MAT_IN',
            toWarehouseId: item.warehouseId,
            partId: item.partId,
            lotId: lot.id,
            qty: item.receivedQty,
            remark: item.remark || dto.remark,
            workerId: dto.workerId,
            refType: 'PO',
            refId: item.poItemId,
          },
          include: { part: true, lot: true, toWarehouse: true },
        });

        // 3. Stock upsert (현재고 반영)
        await this.upsertStock(tx, item.warehouseId, item.partId, lot.id, item.receivedQty);

        // 4. PurchaseOrderItem.receivedQty 증가
        await tx.purchaseOrderItem.update({
          where: { id: item.poItemId },
          data: { receivedQty: { increment: item.receivedQty } },
        });

        results.push(stockTx);
      }

      // 5. PO 상태 재계산
      await this.updatePOStatus(tx, dto.poId);

      return results;
    });
  }

  /** 수동 입하 등록 */
  async createManualArrival(dto: CreateManualArrivalDto) {
    const transNo = `ARR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const lotNo = dto.lotNo || `L${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      // 1. LOT 생성
      const lot = await tx.lot.create({
        data: {
          lotNo,
          partId: dto.partId,
          partType: 'RAW',
          initQty: dto.qty,
          currentQty: dto.qty,
          recvDate: new Date(),
          vendor: dto.vendor,
        },
      });

      // 2. StockTransaction 생성
      const stockTx = await tx.stockTransaction.create({
        data: {
          transNo,
          transType: 'MAT_IN',
          toWarehouseId: dto.warehouseId,
          partId: dto.partId,
          lotId: lot.id,
          qty: dto.qty,
          remark: dto.remark,
          workerId: dto.workerId,
          refType: 'MANUAL',
        },
        include: { part: true, lot: true, toWarehouse: true },
      });

      // 3. Stock upsert
      await this.upsertStock(tx, dto.warehouseId, dto.partId, lot.id, dto.qty);

      return stockTx;
    });
  }

  /** 입하 이력 조회 (MAT_IN + MAT_IN_CANCEL) */
  async findAll(query: ArrivalQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate, status } = query;
    const skip = (page - 1) * limit;

    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    const where: Record<string, unknown> = {
      transType: { in: ['MAT_IN', 'MAT_IN_CANCEL'] },
      ...(status && { status }),
      ...(Object.keys(dateFilter).length > 0 && { transDate: dateFilter }),
      ...(search && {
        OR: [
          { transNo: { contains: search, mode: 'insensitive' as const } },
          { part: { partCode: { contains: search, mode: 'insensitive' as const } } },
          { part: { partName: { contains: search, mode: 'insensitive' as const } } },
          { lot: { poNo: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.stockTransaction.findMany({
        where,
        skip,
        take: limit,
        include: {
          part: { select: { id: true, partCode: true, partName: true, unit: true } },
          lot: { select: { id: true, lotNo: true, poNo: true, vendor: true } },
          toWarehouse: { select: { id: true, warehouseName: true } },
        },
        orderBy: { transDate: 'desc' },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 입하 취소 (역분개 트랜잭션) */
  async cancel(dto: CancelArrivalDto) {
    const original = await this.prisma.stockTransaction.findFirst({
      where: { id: dto.transactionId },
      include: { lot: true },
    });
    if (!original) throw new NotFoundException(`트랜잭션을 찾을 수 없습니다: ${dto.transactionId}`);
    if (original.status === 'CANCELED') throw new BadRequestException('이미 취소된 트랜잭션입니다.');
    if (original.transType !== 'MAT_IN') throw new BadRequestException('입하 트랜잭션만 취소할 수 있습니다.');

    const cancelTransNo = `${original.transNo}-C`;

    return this.prisma.$transaction(async (tx) => {
      // 1. 원본 CANCELED 처리
      await tx.stockTransaction.update({
        where: { id: dto.transactionId },
        data: { status: 'CANCELED' },
      });

      // 2. 역분개 트랜잭션 생성
      const cancelTx = await tx.stockTransaction.create({
        data: {
          transNo: cancelTransNo,
          transType: 'MAT_IN_CANCEL',
          fromWarehouseId: original.toWarehouseId,
          partId: original.partId,
          lotId: original.lotId,
          qty: -original.qty,
          remark: dto.reason,
          workerId: dto.workerId,
          cancelRefId: original.id,
          refType: 'CANCEL',
        },
        include: { part: true, lot: true },
      });

      // 3. Stock 감소
      if (original.toWarehouseId) {
        await this.upsertStock(
          tx, original.toWarehouseId, original.partId, original.lotId, -original.qty,
        );
      }

      // 4. LOT.currentQty 감소
      if (original.lotId) {
        const lot = await tx.lot.findFirst({ where: { id: original.lotId } });
        if (lot) {
          const newQty = Math.max(0, lot.currentQty - original.qty);
          await tx.lot.update({
            where: { id: original.lotId },
            data: {
              currentQty: newQty,
              status: newQty === 0 ? 'DEPLETED' : lot.status,
            },
          });
        }
      }

      // 5. PO receivedQty 감소 + PO status 재계산
      if (original.refType === 'PO' && original.refId) {
        await tx.purchaseOrderItem.update({
          where: { id: original.refId },
          data: { receivedQty: { decrement: original.qty } },
        });
        const poItem = await tx.purchaseOrderItem.findFirst({
          where: { id: original.refId },
        });
        if (poItem) {
          await this.updatePOStatus(tx, poItem.poId);
        }
      }

      return cancelTx;
    });
  }

  /** 오늘 입하 통계 */
  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [todayCount, todayQtyResult, unrecevedPoCount, totalCount] = await Promise.all([
      this.prisma.stockTransaction.count({
        where: { transType: 'MAT_IN', status: 'DONE', transDate: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.stockTransaction.aggregate({
        where: { transType: 'MAT_IN', status: 'DONE', transDate: { gte: todayStart, lte: todayEnd } },
        _sum: { qty: true },
      }),
      this.prisma.purchaseOrder.count({
        where: { status: { in: ['CONFIRMED', 'PARTIAL'] }, deletedAt: null },
      }),
      this.prisma.stockTransaction.count({
        where: { transType: 'MAT_IN' },
      }),
    ]);

    return {
      todayCount,
      todayQty: todayQtyResult._sum.qty || 0,
      unrecevedPoCount: unrecevedPoCount,
      totalCount,
    };
  }

  /** PO 상태 재계산 */
  private async updatePOStatus(tx: any, poId: string) {
    const poItems = await tx.purchaseOrderItem.findMany({
      where: { poId },
    });

    const allReceived = poItems.every(
      (item: { receivedQty: number; orderQty: number }) => item.receivedQty >= item.orderQty,
    );
    const someReceived = poItems.some(
      (item: { receivedQty: number }) => item.receivedQty > 0,
    );

    let newStatus: string;
    if (allReceived) {
      newStatus = 'RECEIVED';
    } else if (someReceived) {
      newStatus = 'PARTIAL';
    } else {
      newStatus = 'CONFIRMED';
    }

    await tx.purchaseOrder.update({
      where: { id: poId },
      data: { status: newStatus },
    });
  }

  /** Stock upsert (현재고 증감) */
  private async upsertStock(tx: any, warehouseId: string, partId: string, lotId: string | null, qtyDelta: number) {
    const existing = await tx.stock.findFirst({
      where: { warehouseId, partId, lotId: lotId || null },
    });

    if (existing) {
      const newQty = Math.max(0, existing.qty + qtyDelta);
      await tx.stock.update({
        where: { id: existing.id },
        data: {
          qty: newQty,
          availableQty: Math.max(0, newQty - existing.reservedQty),
          lastTransAt: new Date(),
        },
      });
    } else if (qtyDelta > 0) {
      await tx.stock.create({
        data: {
          warehouseId,
          partId,
          lotId,
          qty: qtyDelta,
          availableQty: qtyDelta,
          lastTransAt: new Date(),
        },
      });
    }
  }
}
