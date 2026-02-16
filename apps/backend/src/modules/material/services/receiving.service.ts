/**
 * @file src/modules/material/services/receiving.service.ts
 * @description 입고관리 비즈니스 로직 - IQC 합격건 일괄/분할 입고 확정
 *
 * 초보자 가이드:
 * 1. **입고 대상**: LOT.iqcStatus='PASS'이고 아직 입고 미완료인 건
 * 2. **입고 완료 판단**: 해당 LOT에 대한 RECEIVE 트랜잭션 합계가 initQty 이상이면 완료
 * 3. **분할 입고**: LOT의 일부 수량만 입고 가능 (잔량 = initQty - 기입고수량)
 * 4. **Stock 반영**: 입고 시 대상 창고에 Stock upsert
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateBulkReceiveDto, ReceivingQueryDto } from '../dto/receiving.dto';

@Injectable()
export class ReceivingService {
  constructor(private readonly prisma: PrismaService) {}

  /** 입고 가능 LOT 목록 (IQC 합격 + 미입고/부분입고) */
  async findReceivable() {
    // IQC 합격된 LOT 조회
    const lots = await this.prisma.lot.findMany({
      where: {
        iqcStatus: 'PASS',
        status: { in: ['NORMAL', 'HOLD'] },
        deletedAt: null,
        currentQty: { gt: 0 },
      },
      include: {
        part: { select: { id: true, partCode: true, partName: true, unit: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 각 LOT의 기입고수량 계산 (RECEIVE 트랜잭션 합계)
    const lotIds = lots.map((l) => l.id);
    const receiveTxs = await this.prisma.stockTransaction.groupBy({
      by: ['lotId'],
      where: {
        lotId: { in: lotIds },
        transType: 'RECEIVE',
        status: 'DONE',
      },
      _sum: { qty: true },
    });

    const receivedMap = new Map<string, number>();
    for (const tx of receiveTxs) {
      if (tx.lotId) receivedMap.set(tx.lotId, tx._sum.qty || 0);
    }

    // 입하 트랜잭션에서 창고 정보 가져오기
    const arrivalTxs = await this.prisma.stockTransaction.findMany({
      where: {
        lotId: { in: lotIds },
        transType: 'MAT_IN',
        status: 'DONE',
      },
      select: { lotId: true, toWarehouseId: true, toWarehouse: { select: { id: true, warehouseName: true } } },
    });
    const arrivalWhMap = new Map<string, { id: string; warehouseName: string } | null>();
    for (const tx of arrivalTxs) {
      if (tx.lotId) arrivalWhMap.set(tx.lotId, tx.toWarehouse);
    }

    return lots
      .map((lot) => {
        const receivedQty = receivedMap.get(lot.id) || 0;
        const remainingQty = lot.initQty - receivedQty;
        const arrivalWarehouse = arrivalWhMap.get(lot.id);
        return {
          ...lot,
          receivedQty,
          remainingQty,
          arrivalWarehouse: arrivalWarehouse || null,
          // 평면화된 필드
          partCode: lot.part?.partCode,
          partName: lot.part?.partName,
          unit: lot.part?.unit,
          arrivalWarehouseCode: arrivalWarehouse?.id,
          arrivalWarehouseName: arrivalWarehouse?.warehouseName,
        };
      })
      .filter((lot) => lot.remainingQty > 0);
  }

  /** 일괄/분할 입고 처리 */
  async createBulkReceive(dto: CreateBulkReceiveDto) {
    // LOT 검증
    for (const item of dto.items) {
      const lot = await this.prisma.lot.findFirst({
        where: { id: item.lotId, deletedAt: null },
      });
      if (!lot) throw new NotFoundException(`LOT을 찾을 수 없습니다: ${item.lotId}`);
      if (lot.iqcStatus !== 'PASS') throw new BadRequestException(`IQC 합격되지 않은 LOT입니다: ${lot.lotNo}`);

      // 기입고수량 확인
      const receivedAgg = await this.prisma.stockTransaction.aggregate({
        where: { lotId: item.lotId, transType: 'RECEIVE', status: 'DONE' },
        _sum: { qty: true },
      });
      const receivedQty = receivedAgg._sum.qty || 0;
      const remaining = lot.initQty - receivedQty;
      if (item.qty > remaining) {
        throw new BadRequestException(
          `입고수량(${item.qty})이 잔량(${remaining})을 초과합니다. LOT: ${lot.lotNo}`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of dto.items) {
        const transNo = `RCV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

        // 1. StockTransaction(RECEIVE) 생성
        const stockTx = await tx.stockTransaction.create({
          data: {
            transNo,
            transType: 'RECEIVE',
            toWarehouseId: item.warehouseId,
            partId: (await tx.lot.findFirstOrThrow({ where: { id: item.lotId } })).partId,
            lotId: item.lotId,
            qty: item.qty,
            remark: item.remark,
            workerId: dto.workerId,
            refType: 'RECEIVE',
          },
          include: { part: true, lot: true, toWarehouse: true },
        });

        // 2. Stock upsert (입고 창고에 반영)
        await this.upsertStock(tx, item.warehouseId, stockTx.partId, item.lotId, item.qty);

        results.push(stockTx);
      }

      return results;
    });
  }

  /** 입고 이력 조회 */
  async findAll(query: ReceivingQueryDto) {
    const { page = 1, limit = 10, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const dateFilter: Record<string, Date> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    const where: Record<string, unknown> = {
      transType: 'RECEIVE',
      status: 'DONE',
      ...(Object.keys(dateFilter).length > 0 && { transDate: dateFilter }),
      ...(search && {
        OR: [
          { transNo: { contains: search, mode: 'insensitive' as const } },
          { part: { partCode: { contains: search, mode: 'insensitive' as const } } },
          { part: { partName: { contains: search, mode: 'insensitive' as const } } },
          { lot: { lotNo: { contains: search, mode: 'insensitive' as const } } },
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
          lot: { select: { id: true, lotNo: true, poNo: true, vendor: true, initQty: true } },
          toWarehouse: { select: { id: true, warehouseName: true } },
        },
        orderBy: { transDate: 'desc' },
      }),
      this.prisma.stockTransaction.count({ where }),
    ]);

    // 중첩 객체 평면화
    const flattenedData = data.map((item) => ({
      ...item,
      // 평면화된 필드
      partCode: item.part?.partCode,
      partName: item.part?.partName,
      unit: item.part?.unit,
      lotNo: item.lot?.lotNo,
      warehouseCode: item.toWarehouse?.id,
      warehouseName: item.toWarehouse?.warehouseName,
    }));

    return { data: flattenedData, total, page, limit };
  }

  /** 입고 통계 */
  async getStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 입고 대기 LOT 수 (IQC PASS인데 미입고)
    const passedLots = await this.prisma.lot.findMany({
      where: { iqcStatus: 'PASS', status: 'NORMAL', deletedAt: null, currentQty: { gt: 0 } },
      select: { id: true, initQty: true },
    });
    const lotIds = passedLots.map((l) => l.id);
    const receivedAgg = await this.prisma.stockTransaction.groupBy({
      by: ['lotId'],
      where: { lotId: { in: lotIds }, transType: 'RECEIVE', status: 'DONE' },
      _sum: { qty: true },
    });
    const receivedMap = new Map<string, number>();
    for (const r of receivedAgg) {
      if (r.lotId) receivedMap.set(r.lotId, r._sum.qty || 0);
    }
    const pendingLots = passedLots.filter((l) => {
      const received = receivedMap.get(l.id) || 0;
      return received < l.initQty;
    });

    const [todayCount, todayQtyResult] = await Promise.all([
      this.prisma.stockTransaction.count({
        where: { transType: 'RECEIVE', status: 'DONE', transDate: { gte: todayStart, lte: todayEnd } },
      }),
      this.prisma.stockTransaction.aggregate({
        where: { transType: 'RECEIVE', status: 'DONE', transDate: { gte: todayStart, lte: todayEnd } },
        _sum: { qty: true },
      }),
    ]);

    return {
      pendingCount: pendingLots.length,
      pendingQty: pendingLots.reduce((sum, l) => sum + l.initQty - (receivedMap.get(l.id) || 0), 0),
      todayReceivedCount: todayCount,
      todayReceivedQty: todayQtyResult._sum.qty || 0,
    };
  }

  /** Stock upsert */
  private async upsertStock(tx: any, warehouseId: string, partId: string, lotId: string | null, qtyDelta: number) {
    const existing = await tx.stock.findFirst({
      where: { warehouseId, partId, lotId: lotId || null },
    });

    if (existing) {
      const newQty = existing.qty + qtyDelta;
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
        data: { warehouseId, partId, lotId, qty: qtyDelta, availableQty: qtyDelta, lastTransAt: new Date() },
      });
    }
  }
}
