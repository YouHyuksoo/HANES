/**
 * @file src/modules/material/services/mat-stock.service.ts
 * @description 재고 관리 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **MatStock 테이블**: 창고/위치별 품목 재고 현황
 * 2. **주요 필드**: warehouseCode, locationCode, partId, lotId, qty
 * 3. **재고 조정**: 실사 결과 반영 및 수불 처리
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { StockQueryDto, StockAdjustDto, StockTransferDto } from '../dto/mat-stock.dto';

@Injectable()
export class MatStockService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: StockQueryDto) {
    const { page = 1, limit = 10, partId, warehouseCode, locationCode, search, lowStockOnly } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(partId && { partId }),
      ...(warehouseCode && { warehouseCode }),
      ...(locationCode && { locationCode }),
    };

    if (search) {
      where.part = {
        OR: [
          { partCode: { contains: search, mode: 'insensitive' } },
          { partName: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.matStock.findMany({
        where,
        skip,
        take: limit,
        include: {
          part: { select: { id: true, partCode: true, partName: true, unit: true, safetyStock: true } },
          lot: { select: { id: true, lotNo: true, iqcStatus: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.matStock.count({ where }),
    ]);

    // 안전재고 미달 필터링
    let result = data;
    if (lowStockOnly) {
      result = data.filter((stock) => stock.qty < (stock.part?.safetyStock ?? 0));
    }

    // 중첩 객체 평면화
    const flattenedData = result.map((stock) => ({
      ...stock,
      // 평면화된 필드
      partCode: stock.part?.partCode,
      partName: stock.part?.partName,
      unit: stock.part?.unit,
      lotNo: stock.lot?.lotNo,
    }));

    return { data: flattenedData, total, page, limit };
  }

  async findByPartAndWarehouse(partId: string, warehouseCode: string, lotId?: string) {
    const stock = await this.prisma.matStock.findFirst({
      where: { partId, warehouseCode, lotId: lotId ?? null },
      include: { part: true, lot: true },
    });

    if (!stock) return null;

    return {
      ...stock,
      // 평면화된 필드
      partCode: stock.part?.partCode,
      partName: stock.part?.partName,
      unit: stock.part?.unit,
      lotNo: stock.lot?.lotNo,
    };
  }

  async getStockSummary(partId: string) {
    const stocks = await this.prisma.matStock.findMany({
      where: { partId },
      include: { part: true, lot: true },
    });

    const total = stocks.reduce((sum, s) => sum + s.qty, 0);
    const available = stocks.reduce((sum, s) => sum + s.availableQty, 0);

    // 중첩 객체 평면화
    const flattenedStocks = stocks.map((stock) => ({
      ...stock,
      // 평면화된 필드
      partCode: stock.part?.partCode,
      partName: stock.part?.partName,
      unit: stock.part?.unit,
      lotNo: stock.lot?.lotNo,
    }));

    return { partId, totalQty: total, availableQty: available, byWarehouse: flattenedStocks };
  }

  async adjustStock(dto: StockAdjustDto) {
    const { partId, warehouseCode, locationCode, adjustQty, reason, lotId } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 기존 재고 조회 또는 생성
      let stock = await tx.matStock.findFirst({
        where: { partId, warehouseCode, lotId: lotId ?? null },
      });

      const beforeQty = stock?.qty ?? 0;
      const afterQty = beforeQty + adjustQty;

      if (afterQty < 0) {
        throw new BadRequestException(`재고가 음수가 될 수 없습니다. 현재: ${beforeQty}, 조정: ${adjustQty}`);
      }

      if (stock) {
        stock = await tx.matStock.update({
          where: { id: stock.id },
          data: {
            qty: afterQty,
            availableQty: afterQty - stock.reservedQty,
          },
        });
      } else {
        if (adjustQty < 0) {
          throw new BadRequestException('재고가 없는 상태에서 감소 조정을 할 수 없습니다.');
        }
        stock = await tx.matStock.create({
          data: {
            partId,
            warehouseCode,
            locationCode,
            lotId,
            qty: adjustQty,
            availableQty: adjustQty,
            reservedQty: 0,
          },
        });
      }

      // 조정 이력 기록
      await tx.invAdjLog.create({
        data: {
          partId,
          warehouseCode,
          lotId,
          adjType: 'ADJUST',
          beforeQty,
          afterQty,
          diffQty: adjustQty,
          reason,
        },
      });

      return stock;
    });
  }

  async transferStock(dto: StockTransferDto) {
    const { partId, fromWarehouseCode, toWarehouseCode, qty, lotId } = dto;

    return this.prisma.$transaction(async (tx) => {
      // 출고 창고 재고 확인
      const fromStock = await tx.matStock.findFirst({
        where: { partId, warehouseCode: fromWarehouseCode, lotId: lotId ?? null },
      });

      if (!fromStock || fromStock.qty < qty) {
        throw new BadRequestException(`출고 창고 재고 부족: ${fromStock?.qty ?? 0}`);
      }

      // 출고 창고 차감
      await tx.matStock.update({
        where: { id: fromStock.id },
        data: {
          qty: fromStock.qty - qty,
          availableQty: fromStock.availableQty - qty,
        },
      });

      // 입고 창고 재고 확인 또는 생성
      let toStock = await tx.matStock.findFirst({
        where: { partId, warehouseCode: toWarehouseCode, lotId: lotId ?? null },
      });

      if (toStock) {
        toStock = await tx.matStock.update({
          where: { id: toStock.id },
          data: {
            qty: toStock.qty + qty,
            availableQty: toStock.availableQty + qty,
          },
        });
      } else {
        toStock = await tx.matStock.create({
          data: {
            partId,
            warehouseCode: toWarehouseCode,
            lotId,
            qty,
            availableQty: qty,
            reservedQty: 0,
          },
        });
      }

      return { fromStock, toStock };
    });
  }
}
