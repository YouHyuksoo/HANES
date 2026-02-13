/**
 * @file src/modules/production/services/production-views.service.ts
 * @description 생산관리 조회 전용 서비스 - 작업진행현황, 샘플검사이력, 포장실적, 반제품/제품재고
 *
 * 초보자 가이드:
 * 1. **작업진행현황**: JobOrder + ProdResult 집계를 조합한 대시보드 데이터
 * 2. **샘플검사이력**: InspectResult 테이블 조회
 * 3. **포장실적**: BoxMaster 테이블 조회
 * 4. **반제품/제품재고**: Stock 테이블에서 partType=WIP/FG 필터링
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ProgressQueryDto,
  SampleInspectQueryDto,
  PackResultQueryDto,
  WipStockQueryDto,
} from '../dto/production-views.dto';

@Injectable()
export class ProductionViewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 작업지시 진행현황 조회 (대시보드)
   */
  async getProgress(query: ProgressQueryDto) {
    const { page = 1, limit = 20, status, planDateFrom, planDateTo, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && {
        OR: [
          { orderNo: { contains: search, mode: 'insensitive' } },
          { part: { partCode: { contains: search, mode: 'insensitive' } } },
          { part: { partName: { contains: search, mode: 'insensitive' } } },
        ],
      }),
      ...(planDateFrom || planDateTo
        ? {
            planDate: {
              ...(planDateFrom && { gte: new Date(planDateFrom) }),
              ...(planDateTo && { lte: new Date(planDateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.jobOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'asc' }, { planDate: 'asc' }],
        include: {
          part: {
            select: { id: true, partCode: true, partName: true, partType: true },
          },
        },
      }),
      this.prisma.jobOrder.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 샘플검사이력 조회
   */
  async getSampleInspect(query: SampleInspectQueryDto) {
    const { page = 1, limit = 10, passYn, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      ...(passYn && { passYn }),
      ...(search && {
        OR: [
          { lotNo: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(dateFrom || dateTo
        ? {
            inspectDate: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.inspectResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          prodResult: {
            select: {
              id: true,
              lotNo: true,
              jobOrder: {
                select: { id: true, orderNo: true, part: { select: { partCode: true, partName: true } } },
              },
            },
          },
        },
      }),
      this.prisma.inspectResult.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 포장실적 조회
   */
  async getPackResult(query: PackResultQueryDto) {
    const { page = 1, limit = 10, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      ...(search && {
        OR: [
          { boxNo: { contains: search, mode: 'insensitive' } },
          { lotNo: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(dateFrom || dateTo
        ? {
            packDate: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && { lte: new Date(dateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.boxMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.boxMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 반제품/제품 재고 조회
   */
  async getWipStock(query: WipStockQueryDto) {
    const { page = 1, limit = 10, partType, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: null,
      part: {
        partType: partType ? { equals: partType } : { in: ['WIP', 'FG'] },
        ...(search && {
          OR: [
            { partCode: { contains: search, mode: 'insensitive' } },
            { partName: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.stock.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          part: {
            select: { id: true, partCode: true, partName: true, partType: true, unit: true },
          },
        },
      }),
      this.prisma.stock.count({ where }),
    ]);

    return { data, total, page, limit };
  }
}
