/**
 * @file src/modules/quality/services/inspect-result.service.ts
 * @description 검사실적 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 검사 결과 생성, 조회, 수정, 삭제
 * 2. **통계 메서드**: 합격률 계산, 유형별 통계
 * 3. **Prisma 사용**: PrismaService를 통해 DB 접근
 *
 * 주요 기능:
 * - 검사 결과 등록 (생산실적과 연결)
 * - 시리얼 번호별 검사 이력 조회
 * - 합격률 통계 (전체, 기간별, 유형별)
 */

import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateInspectResultDto,
  UpdateInspectResultDto,
  InspectResultQueryDto,
  InspectPassRateDto,
  InspectTypeStatsDto,
} from '../dto/inspect-result.dto';

@Injectable()
export class InspectResultService {
  private readonly logger = new Logger(InspectResultService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 검사실적 목록 조회 (페이지네이션)
   */
  async findAll(query: InspectResultQueryDto) {
    const {
      page = 1,
      limit = 20,
      prodResultId,
      serialNo,
      inspectType,
      passYn,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(prodResultId && { prodResultId }),
      ...(serialNo && { serialNo: { contains: serialNo, mode: 'insensitive' as const } }),
      ...(inspectType && { inspectType }),
      ...(passYn && { passYn }),
      ...(startDate || endDate
        ? {
            inspectTime: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.inspectResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: { inspectTime: 'desc' },
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
        },
      }),
      this.prisma.inspectResult.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 검사실적 단건 조회
   */
  async findById(id: string) {
    const result = await this.prisma.inspectResult.findUnique({
      where: { id },
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
      },
    });

    if (!result) {
      throw new NotFoundException(`검사실적을 찾을 수 없습니다: ${id}`);
    }

    return result;
  }

  /**
   * 시리얼 번호로 검사 이력 조회
   */
  async findBySerialNo(serialNo: string) {
    const results = await this.prisma.inspectResult.findMany({
      where: { serialNo },
      orderBy: { inspectTime: 'desc' },
      include: {
        prodResult: {
          select: {
            lotNo: true,
            processCode: true,
          },
        },
      },
    });

    return results;
  }

  /**
   * 생산실적별 검사 이력 조회
   */
  async findByProdResultId(prodResultId: string) {
    const results = await this.prisma.inspectResult.findMany({
      where: { prodResultId },
      orderBy: { inspectTime: 'asc' },
    });

    return results;
  }

  /**
   * 검사실적 생성
   */
  async create(dto: CreateInspectResultDto) {
    // 생산실적 존재 확인
    const prodResult = await this.prisma.prodResult.findUnique({
      where: { id: dto.prodResultId },
    });

    if (!prodResult) {
      throw new NotFoundException(`생산실적을 찾을 수 없습니다: ${dto.prodResultId}`);
    }

    return this.prisma.inspectResult.create({
      data: {
        prodResultId: dto.prodResultId,
        serialNo: dto.serialNo,
        inspectType: dto.inspectType,
        passYn: dto.passYn ?? 'Y',
        errorCode: dto.errorCode,
        errorDetail: dto.errorDetail,
        inspectData: dto.inspectData as Prisma.InputJsonValue ?? Prisma.JsonNull,
        inspectTime: dto.inspectTime ? new Date(dto.inspectTime) : new Date(),
        inspectorId: dto.inspectorId,
      },
    });
  }

  /**
   * 검사실적 일괄 생성
   */
  async createMany(dtos: CreateInspectResultDto[]) {
    const results = await this.prisma.$transaction(
      dtos.map((dto) =>
        this.prisma.inspectResult.create({
          data: {
            prodResultId: dto.prodResultId,
            serialNo: dto.serialNo,
            inspectType: dto.inspectType,
            passYn: dto.passYn ?? 'Y',
            errorCode: dto.errorCode,
            errorDetail: dto.errorDetail,
            inspectData: dto.inspectData as Prisma.InputJsonValue ?? Prisma.JsonNull,
            inspectTime: dto.inspectTime ? new Date(dto.inspectTime) : new Date(),
            inspectorId: dto.inspectorId,
          },
        })
      )
    );

    return { count: results.length, results };
  }

  /**
   * 검사실적 수정
   */
  async update(id: string, dto: UpdateInspectResultDto) {
    await this.findById(id); // 존재 확인

    const updateData: Prisma.InspectResultUpdateInput = {};

    if (dto.serialNo !== undefined) updateData.serialNo = dto.serialNo;
    if (dto.inspectType !== undefined) updateData.inspectType = dto.inspectType;
    if (dto.passYn !== undefined) updateData.passYn = dto.passYn;
    if (dto.errorCode !== undefined) updateData.errorCode = dto.errorCode;
    if (dto.errorDetail !== undefined) updateData.errorDetail = dto.errorDetail;
    if (dto.inspectData !== undefined) updateData.inspectData = dto.inspectData as Prisma.InputJsonValue;
    if (dto.inspectTime !== undefined) updateData.inspectTime = new Date(dto.inspectTime);
    if (dto.inspectorId !== undefined) updateData.inspectorId = dto.inspectorId;

    return this.prisma.inspectResult.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * 검사실적 삭제
   */
  async delete(id: string) {
    await this.findById(id); // 존재 확인

    return this.prisma.inspectResult.delete({
      where: { id },
    });
  }

  /**
   * 합격률 통계 조회
   * @param startDate 시작 날짜
   * @param endDate 종료 날짜
   * @param inspectType 검사 유형 (선택)
   */
  async getPassRate(
    startDate?: string,
    endDate?: string,
    inspectType?: string
  ): Promise<InspectPassRateDto> {
    const where = {
      ...(inspectType && { inspectType }),
      ...(startDate || endDate
        ? {
            inspectTime: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [totalCount, passCount] = await Promise.all([
      this.prisma.inspectResult.count({ where }),
      this.prisma.inspectResult.count({
        where: { ...where, passYn: 'Y' },
      }),
    ]);

    const failCount = totalCount - passCount;
    const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 10000) / 100 : 0;

    return {
      totalCount,
      passCount,
      failCount,
      passRate,
    };
  }

  /**
   * 검사 유형별 통계 조회
   * @param startDate 시작 날짜
   * @param endDate 종료 날짜
   */
  async getStatsByType(
    startDate?: string,
    endDate?: string
  ): Promise<InspectTypeStatsDto[]> {
    const where = {
      inspectType: { not: null },
      ...(startDate || endDate
        ? {
            inspectTime: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    // 유형별 그룹 조회
    const groupedData = await this.prisma.inspectResult.groupBy({
      by: ['inspectType'],
      where,
      _count: { inspectType: true },
    });

    // 유형별 합격 수 조회
    const passData = await this.prisma.inspectResult.groupBy({
      by: ['inspectType'],
      where: { ...where, passYn: 'Y' },
      _count: { inspectType: true },
    });

    const passMap = new Map(
      passData.map((p) => [p.inspectType, p._count.inspectType])
    );

    return groupedData.map((g) => {
      const totalCount = g._count.inspectType;
      const passCount = passMap.get(g.inspectType) ?? 0;
      const passRate = totalCount > 0 ? Math.round((passCount / totalCount) * 10000) / 100 : 0;

      return {
        inspectType: g.inspectType!,
        totalCount,
        passCount,
        passRate,
      };
    });
  }

  /**
   * 일별 합격률 추이 조회
   * @param days 조회 일수 (기본 7일)
   */
  async getDailyPassRateTrend(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    const results = await this.prisma.inspectResult.findMany({
      where: {
        inspectTime: { gte: startDate },
      },
      select: {
        inspectTime: true,
        passYn: true,
      },
      orderBy: { inspectTime: 'asc' },
    });

    // 일별 집계
    const dailyStats = new Map<string, { total: number; pass: number }>();

    results.forEach((r) => {
      const dateKey = r.inspectTime.toISOString().split('T')[0];
      const current = dailyStats.get(dateKey) ?? { total: 0, pass: 0 };
      current.total++;
      if (r.passYn === 'Y') current.pass++;
      dailyStats.set(dateKey, current);
    });

    return Array.from(dailyStats.entries()).map(([date, stats]) => ({
      date,
      totalCount: stats.total,
      passCount: stats.pass,
      failCount: stats.total - stats.pass,
      passRate: stats.total > 0 ? Math.round((stats.pass / stats.total) * 10000) / 100 : 0,
    }));
  }
}
