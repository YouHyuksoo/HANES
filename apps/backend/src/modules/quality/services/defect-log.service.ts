/**
 * @file src/modules/quality/services/defect-log.service.ts
 * @description 불량로그 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **불량 CRUD**: 불량 등록, 조회, 수정, 삭제
 * 2. **상태 관리**: 대기 -> 수리 -> 완료/폐기 흐름
 * 3. **수리 이력**: 수리 작업 기록 관리
 *
 * 불량 처리 흐름:
 * 1. 불량 발생 등록 (WAIT)
 * 2. 수리 시작 (REPAIR) / 재작업 (REWORK)
 * 3. 수리 완료 등록 -> 상태 변경 (DONE) or 폐기 (SCRAP)
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateDefectLogDto,
  UpdateDefectLogDto,
  DefectLogQueryDto,
  ChangeDefectStatusDto,
  CreateRepairLogDto,
  DefectStatus,
  DefectTypeStatsDto,
  DefectStatusStatsDto,
} from '../dto/defect-log.dto';

@Injectable()
export class DefectLogService {
  private readonly logger = new Logger(DefectLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // 불량로그 CRUD
  // =============================================

  /**
   * 불량로그 목록 조회 (페이지네이션)
   */
  async findAll(query: DefectLogQueryDto) {
    const {
      page = 1,
      limit = 20,
      prodResultId,
      defectCode,
      status,
      startDate,
      endDate,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(prodResultId && { prodResultId }),
      ...(defectCode && { defectCode }),
      ...(status && { status }),
      ...(startDate || endDate
        ? {
            occurTime: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
      ...(search && {
        OR: [
          { defectName: { contains: search, mode: 'insensitive' as const } },
          { cause: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.defectLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurTime: 'desc' },
        include: {
          prodResult: {
            select: {
              id: true,
              lotNo: true,
              processCode: true,
              jobOrder: {
                select: {
                  orderNo: true,
                  part: {
                    select: { partCode: true, partName: true },
                  },
                },
              },
            },
          },
          repairLogs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.defectLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 불량로그 단건 조회
   */
  async findById(id: string) {
    const defect = await this.prisma.defectLog.findFirst({
      where: { id, deletedAt: null },
      include: {
        prodResult: {
          include: {
            jobOrder: {
              select: {
                orderNo: true,
                part: {
                  select: { partCode: true, partName: true },
                },
              },
            },
            equip: {
              select: { equipCode: true, equipName: true },
            },
          },
        },
        repairLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            worker: {
              select: { id: true, name: true, empNo: true },
            },
          },
        },
      },
    });

    if (!defect) {
      throw new NotFoundException(`불량로그를 찾을 수 없습니다: ${id}`);
    }

    return defect;
  }

  /**
   * 생산실적별 불량 목록 조회
   */
  async findByProdResultId(prodResultId: string) {
    const defects = await this.prisma.defectLog.findMany({
      where: { prodResultId, deletedAt: null },
      orderBy: { occurTime: 'desc' },
      include: {
        repairLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return defects;
  }

  /**
   * 불량로그 생성
   */
  async create(dto: CreateDefectLogDto) {
    // 생산실적 존재 확인
    const prodResult = await this.prisma.prodResult.findUnique({
      where: { id: dto.prodResultId },
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${dto.prodResultId}`);
    }

    // 불량 등록 및 생산실적 불량수량 증가를 트랜잭션으로 처리
    const [defectLog] = await this.prisma.$transaction([
      this.prisma.defectLog.create({
        data: {
          prodResultId: dto.prodResultId,
          defectCode: dto.defectCode,
          defectName: dto.defectName,
          qty: dto.qty ?? 1,
          status: dto.status ?? DefectStatus.WAIT,
          cause: dto.cause,
          occurTime: dto.occurTime ? new Date(dto.occurTime) : new Date(),
          imageUrl: dto.imageUrl,
        },
      }),
      // 생산실적의 불량수량 증가
      this.prisma.prodResult.update({
        where: { id: dto.prodResultId },
        data: {
          defectQty: { increment: dto.qty ?? 1 },
        },
      }),
    ]);

    return defectLog;
  }

  /**
   * 불량로그 수정
   */
  async update(id: string, dto: UpdateDefectLogDto) {
    const existing = await this.findById(id);

    // 수량 변경 시 생산실적 반영
    const qtyDiff = (dto.qty ?? existing.qty) - existing.qty;

    if (qtyDiff !== 0) {
      await this.prisma.$transaction([
        this.prisma.defectLog.update({
          where: { id },
          data: {
            ...(dto.defectCode !== undefined && { defectCode: dto.defectCode }),
            ...(dto.defectName !== undefined && { defectName: dto.defectName }),
            ...(dto.qty !== undefined && { qty: dto.qty }),
            ...(dto.cause !== undefined && { cause: dto.cause }),
            ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          },
        }),
        this.prisma.prodResult.update({
          where: { id: existing.prodResultId },
          data: {
            defectQty: { increment: qtyDiff },
          },
        }),
      ]);
    } else {
      await this.prisma.defectLog.update({
        where: { id },
        data: {
          ...(dto.defectCode !== undefined && { defectCode: dto.defectCode }),
          ...(dto.defectName !== undefined && { defectName: dto.defectName }),
          ...(dto.cause !== undefined && { cause: dto.cause }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        },
      });
    }

    return this.findById(id);
  }

  /**
   * 불량로그 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    const existing = await this.findById(id);

    // 불량 삭제 시 생산실적 불량수량 감소
    await this.prisma.$transaction([
      this.prisma.defectLog.update({
        where: { id },
        data: { deletedAt: new Date() },
      }),
      this.prisma.prodResult.update({
        where: { id: existing.prodResultId },
        data: {
          defectQty: { decrement: existing.qty },
        },
      }),
    ]);

    return { id, deleted: true };
  }

  // =============================================
  // 불량 상태 관리
  // =============================================

  /**
   * 불량 상태 변경
   */
  async changeStatus(id: string, dto: ChangeDefectStatusDto) {
    const existing = await this.findById(id);

    // 상태 변경 유효성 검사
    this.validateStatusChange(existing.status as DefectStatus, dto.status);

    return this.prisma.defectLog.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  /**
   * 상태 변경 유효성 검사
   */
  private validateStatusChange(currentStatus: DefectStatus, newStatus: DefectStatus) {
    const validTransitions: Record<DefectStatus, DefectStatus[]> = {
      [DefectStatus.WAIT]: [DefectStatus.REPAIR, DefectStatus.REWORK, DefectStatus.SCRAP],
      [DefectStatus.REPAIR]: [DefectStatus.DONE, DefectStatus.SCRAP, DefectStatus.WAIT],
      [DefectStatus.REWORK]: [DefectStatus.DONE, DefectStatus.SCRAP, DefectStatus.WAIT],
      [DefectStatus.SCRAP]: [], // 폐기 후 변경 불가
      [DefectStatus.DONE]: [], // 완료 후 변경 불가
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `${currentStatus}에서 ${newStatus}로 상태 변경이 불가능합니다.`
      );
    }
  }

  // =============================================
  // 수리 이력 관리
  // =============================================

  /**
   * 수리 이력 생성
   */
  async createRepairLog(dto: CreateRepairLogDto) {
    const defectLog = await this.findById(dto.defectLogId);

    // WAIT 상태가 아니면 자동으로 REPAIR 상태로 변경하지 않음
    // 이미 REPAIR/REWORK 상태일 수 있음

    const repairLog = await this.prisma.repairLog.create({
      data: {
        defectLogId: dto.defectLogId,
        workerId: dto.workerId,
        repairAction: dto.repairAction,
        materialUsed: dto.materialUsed,
        repairTime: dto.repairTime,
        result: dto.result,
        remark: dto.remark,
      },
      include: {
        worker: {
          select: { id: true, name: true, empNo: true },
        },
      },
    });

    // 수리 결과에 따라 불량 상태 자동 변경
    if (dto.result) {
      let newStatus: DefectStatus;
      switch (dto.result) {
        case 'PASS':
          newStatus = DefectStatus.DONE;
          break;
        case 'SCRAP':
          newStatus = DefectStatus.SCRAP;
          break;
        default:
          // FAIL인 경우 상태 유지
          return repairLog;
      }

      await this.prisma.defectLog.update({
        where: { id: dto.defectLogId },
        data: { status: newStatus },
      });
    }

    return repairLog;
  }

  /**
   * 불량로그별 수리 이력 조회
   */
  async getRepairLogs(defectLogId: string) {
    await this.findById(defectLogId); // 존재 확인

    return this.prisma.repairLog.findMany({
      where: { defectLogId },
      orderBy: { createdAt: 'desc' },
      include: {
        worker: {
          select: { id: true, name: true, empNo: true },
        },
      },
    });
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 불량 유형별 통계
   */
  async getStatsByDefectType(
    startDate?: string,
    endDate?: string
  ): Promise<DefectTypeStatsDto[]> {
    const where = {
      deletedAt: null,
      ...(startDate || endDate
        ? {
            occurTime: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const grouped = await this.prisma.defectLog.groupBy({
      by: ['defectCode', 'defectName'],
      where,
      _count: { defectCode: true },
      _sum: { qty: true },
    });

    const total = grouped.reduce((sum, g) => sum + g._count.defectCode, 0);

    return grouped
      .map((g) => ({
        defectCode: g.defectCode,
        defectName: g.defectName ?? g.defectCode,
        count: g._count.defectCode,
        totalQty: g._sum.qty ?? 0,
        percentage: total > 0 ? Math.round((g._count.defectCode / total) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * 불량 상태별 통계
   */
  async getStatsByStatus(
    startDate?: string,
    endDate?: string
  ): Promise<DefectStatusStatsDto[]> {
    const where = {
      deletedAt: null,
      ...(startDate || endDate
        ? {
            occurTime: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const grouped = await this.prisma.defectLog.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
      _sum: { qty: true },
    });

    return grouped.map((g) => ({
      status: g.status as DefectStatus,
      count: g._count.status,
      totalQty: g._sum.qty ?? 0,
    }));
  }

  /**
   * 일별 불량 발생 추이
   */
  async getDailyDefectTrend(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const defects = await this.prisma.defectLog.findMany({
      where: {
        deletedAt: null,
        occurTime: { gte: startDate },
      },
      select: {
        occurTime: true,
        qty: true,
        defectCode: true,
      },
      orderBy: { occurTime: 'asc' },
    });

    // 일별 집계
    const dailyStats = new Map<string, { count: number; totalQty: number }>();

    defects.forEach((d) => {
      const dateKey = d.occurTime.toISOString().split('T')[0];
      const current = dailyStats.get(dateKey) ?? { count: 0, totalQty: 0 };
      current.count++;
      current.totalQty += d.qty;
      dailyStats.set(dateKey, current);
    });

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      count: stats.count,
      totalQty: stats.totalQty,
    }));
  }

  /**
   * 미처리 불량 목록 조회
   */
  async getPendingDefects() {
    return this.prisma.defectLog.findMany({
      where: {
        deletedAt: null,
        status: { in: [DefectStatus.WAIT, DefectStatus.REPAIR, DefectStatus.REWORK] },
      },
      orderBy: { occurTime: 'asc' },
      include: {
        prodResult: {
          select: {
            lotNo: true,
            processCode: true,
            jobOrder: {
              select: {
                orderNo: true,
                part: {
                  select: { partCode: true, partName: true },
                },
              },
            },
          },
        },
      },
    });
  }
}
