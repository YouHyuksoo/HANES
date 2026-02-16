/**
 * @file src/modules/production/services/prod-result.service.ts
 * @description 생산실적 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **실적 집계**: 작업지시별, 설비별, 작업자별 실적 집계
 * 3. **Prisma 사용**: PrismaService를 통해 DB 접근
 *
 * 실제 DB 스키마 (prod_results 테이블):
 * - jobOrderId로 작업지시와 연결
 * - status: RUNNING, DONE, CANCELED
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateProdResultDto,
  UpdateProdResultDto,
  ProdResultQueryDto,
  CompleteProdResultDto,
} from '../dto/prod-result.dto';

@Injectable()
export class ProdResultService {
  private readonly logger = new Logger(ProdResultService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 생산실적 목록 조회
   */
  async findAll(query: ProdResultQueryDto, company?: string) {
    const {
      page = 1,
      limit = 10,
      jobOrderId,
      equipId,
      workerId,
      lotNo,
      processCode,
      status,
      startTimeFrom,
      startTimeTo,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(jobOrderId && { jobOrderId }),
      ...(equipId && { equipId }),
      ...(workerId && { workerId }),
      ...(lotNo && { lotNo: { contains: lotNo, mode: 'insensitive' as const } }),
      ...(processCode && { processCode }),
      ...(status && { status }),
      ...(startTimeFrom || startTimeTo
        ? {
            startAt: {
              ...(startTimeFrom && { gte: new Date(startTimeFrom) }),
              ...(startTimeTo && { lte: new Date(startTimeTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.prodResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          jobOrder: {
            select: {
              id: true,
              orderNo: true,
              planQty: true,
              status: true,
            },
          },
          equip: {
            select: {
              id: true,
              equipCode: true,
              equipName: true,
            },
          },
          worker: {
            select: {
              id: true,
              name: true,
              empNo: true,
            },
          },
        },
      }),
      this.prisma.prodResult.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 생산실적 단건 조회 (ID)
   */
  async findById(id: string) {
    const prodResult = await this.prisma.prodResult.findFirst({
      where: { id, deletedAt: null },
      include: {
        jobOrder: {
          select: {
            id: true,
            orderNo: true,
            partId: true,
            planQty: true,
            status: true,
            part: {
              select: {
                id: true,
                partCode: true,
                partName: true,
              },
            },
          },
        },
        equip: {
          select: {
            id: true,
            equipCode: true,
            equipName: true,
          },
        },
        worker: {
          select: {
            id: true,
            name: true,
            empNo: true,
          },
        },
        inspectResults: {
          where: { passYn: 'N' },
          take: 10,
        },
        defectLogs: {
          where: { deletedAt: null },
          take: 10,
        },
      },
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${id}`);
    }

    return prodResult;
  }

  /**
   * 작업지시별 생산실적 목록 조회
   */
  async findByJobOrderId(jobOrderId: string) {
    return this.prisma.prodResult.findMany({
      where: { jobOrderId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: {
        equip: {
          select: {
            id: true,
            equipCode: true,
            equipName: true,
          },
        },
        worker: {
          select: {
            id: true,
            name: true,
            empNo: true,
          },
        },
      },
    });
  }

  /**
   * 생산실적 생성
   */
  async create(dto: CreateProdResultDto) {
    // 작업지시 존재 및 상태 확인
    const jobOrder = await this.prisma.jobOrder.findFirst({
      where: { id: dto.jobOrderId, deletedAt: null },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${dto.jobOrderId}`);
    }

    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시에는 실적을 등록할 수 없습니다.`);
    }

    // 설비 존재 확인 (옵션)
    if (dto.equipId) {
      const equip = await this.prisma.equipMaster.findFirst({
        where: { id: dto.equipId, deletedAt: null },
      });
      if (!equip) {
        throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipId}`);
      }
    }

    // 작업자 존재 확인 (옵션)
    if (dto.workerId) {
      const worker = await this.prisma.user.findFirst({
        where: { id: dto.workerId, deletedAt: null },
      });
      if (!worker) {
        throw new NotFoundException(`작업자를 찾을 수 없습니다: ${dto.workerId}`);
      }
    }

    return this.prisma.prodResult.create({
      data: {
        jobOrderId: dto.jobOrderId,
        equipId: dto.equipId,
        workerId: dto.workerId,
        lotNo: dto.lotNo,
        processCode: dto.processCode,
        goodQty: dto.goodQty ?? 0,
        defectQty: dto.defectQty ?? 0,
        startAt: dto.startAt ? new Date(dto.startAt) : new Date(),
        endAt: dto.endAt ? new Date(dto.endAt) : null,
        cycleTime: dto.cycleTime,
        status: 'RUNNING',
        remark: dto.remark,
      },
      include: {
        jobOrder: {
          select: {
            id: true,
            orderNo: true,
          },
        },
        equip: {
          select: {
            id: true,
            equipCode: true,
            equipName: true,
          },
        },
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 생산실적 수정
   */
  async update(id: string, dto: UpdateProdResultDto) {
    const prodResult = await this.findById(id);

    // DONE 상태에서는 일부 필드만 수정 가능
    if (prodResult.status === 'DONE') {
      if (dto.jobOrderId || dto.equipId || dto.workerId || dto.startAt) {
        throw new BadRequestException(`완료된 실적의 핵심 정보는 수정할 수 없습니다.`);
      }
    }

    return this.prisma.prodResult.update({
      where: { id },
      data: {
        ...(dto.equipId !== undefined && { equipId: dto.equipId }),
        ...(dto.workerId !== undefined && { workerId: dto.workerId }),
        ...(dto.lotNo !== undefined && { lotNo: dto.lotNo }),
        ...(dto.processCode !== undefined && { processCode: dto.processCode }),
        ...(dto.goodQty !== undefined && { goodQty: dto.goodQty }),
        ...(dto.defectQty !== undefined && { defectQty: dto.defectQty }),
        ...(dto.startAt !== undefined && { startAt: new Date(dto.startAt) }),
        ...(dto.endAt !== undefined && { endAt: new Date(dto.endAt) }),
        ...(dto.cycleTime !== undefined && { cycleTime: dto.cycleTime }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
      },
      include: {
        jobOrder: {
          select: {
            id: true,
            orderNo: true,
          },
        },
        equip: {
          select: {
            id: true,
            equipCode: true,
            equipName: true,
          },
        },
        worker: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 생산실적 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    await this.findById(id); // 존재 확인

    return this.prisma.prodResult.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * 생산실적 완료
   */
  async complete(id: string, dto: CompleteProdResultDto) {
    const prodResult = await this.findById(id);

    if (prodResult.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${prodResult.status})에서는 완료할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    return this.prisma.prodResult.update({
      where: { id },
      data: {
        status: 'DONE',
        endAt: dto.endAt ? new Date(dto.endAt) : new Date(),
        ...(dto.goodQty !== undefined && { goodQty: dto.goodQty }),
        ...(dto.defectQty !== undefined && { defectQty: dto.defectQty }),
        ...(dto.remark && { remark: dto.remark }),
      },
      include: {
        jobOrder: {
          select: {
            id: true,
            orderNo: true,
          },
        },
      },
    });
  }

  /**
   * 생산실적 취소
   */
  async cancel(id: string, remark?: string) {
    const prodResult = await this.findById(id);

    if (prodResult.status === 'CANCELED') {
      throw new BadRequestException(`이미 취소된 실적입니다.`);
    }

    return this.prisma.prodResult.update({
      where: { id },
      data: {
        status: 'CANCELED',
        ...(remark && { remark }),
      },
    });
  }

  // ===== 실적 집계 =====

  /**
   * 작업지시별 실적 집계
   */
  async getSummaryByJobOrder(jobOrderId: string) {
    const summary = await this.prisma.prodResult.aggregate({
      where: { jobOrderId, deletedAt: null, status: { not: 'CANCELED' } },
      _sum: {
        goodQty: true,
        defectQty: true,
      },
      _avg: {
        cycleTime: true,
      },
      _count: true,
    });

    const totalGoodQty = summary._sum.goodQty ?? 0;
    const totalDefectQty = summary._sum.defectQty ?? 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      jobOrderId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary._avg.cycleTime ? Number(summary._avg.cycleTime) : null,
      resultCount: summary._count,
    };
  }

  /**
   * 설비별 실적 집계
   */
  async getSummaryByEquip(equipId: string, dateFrom?: string, dateTo?: string) {
    const where: any = {
      equipId,
      deletedAt: null,
      status: { not: 'CANCELED' },
    };

    if (dateFrom || dateTo) {
      where.startAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const summary = await this.prisma.prodResult.aggregate({
      where,
      _sum: {
        goodQty: true,
        defectQty: true,
      },
      _avg: {
        cycleTime: true,
      },
      _count: true,
    });

    const totalGoodQty = summary._sum.goodQty ?? 0;
    const totalDefectQty = summary._sum.defectQty ?? 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      equipId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary._avg.cycleTime ? Number(summary._avg.cycleTime) : null,
      resultCount: summary._count,
    };
  }

  /**
   * 작업자별 실적 집계
   */
  async getSummaryByWorker(workerId: string, dateFrom?: string, dateTo?: string) {
    const where: any = {
      workerId,
      deletedAt: null,
      status: { not: 'CANCELED' },
    };

    if (dateFrom || dateTo) {
      where.startAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const summary = await this.prisma.prodResult.aggregate({
      where,
      _sum: {
        goodQty: true,
        defectQty: true,
      },
      _avg: {
        cycleTime: true,
      },
      _count: true,
    });

    const totalGoodQty = summary._sum.goodQty ?? 0;
    const totalDefectQty = summary._sum.defectQty ?? 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      workerId,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary._avg.cycleTime ? Number(summary._avg.cycleTime) : null,
      resultCount: summary._count,
    };
  }

  /**
   * 일자별 실적 집계 (대시보드용)
   */
  async getDailySummary(dateFrom: string, dateTo: string) {
    const results = await this.prisma.prodResult.findMany({
      where: {
        deletedAt: null,
        status: { not: 'CANCELED' },
        startAt: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      },
      select: {
        startAt: true,
        goodQty: true,
        defectQty: true,
      },
    });

    // 일자별 그룹핑
    const dailyMap = new Map<string, { goodQty: number; defectQty: number; count: number }>();

    results.forEach((r) => {
      if (r.startAt) {
        const dateKey = r.startAt.toISOString().split('T')[0];
        const current = dailyMap.get(dateKey) || { goodQty: 0, defectQty: 0, count: 0 };
        current.goodQty += r.goodQty;
        current.defectQty += r.defectQty;
        current.count += 1;
        dailyMap.set(dateKey, current);
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        goodQty: data.goodQty,
        defectQty: data.defectQty,
        totalQty: data.goodQty + data.defectQty,
        defectRate:
          data.goodQty + data.defectQty > 0
            ? (data.defectQty / (data.goodQty + data.defectQty)) * 100
            : 0,
        resultCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
