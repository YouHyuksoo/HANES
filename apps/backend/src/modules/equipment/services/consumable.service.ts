/**
 * @file src/modules/equipment/services/consumable.service.ts
 * @description 소모품(금형/지그/공구) 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 소모품 생성, 조회, 수정, 삭제
 * 2. **수명 관리**:
 *    - increaseCount: 사용 횟수 증가
 *    - registerReplacement: 교체 등록
 *    - updateWarningStatus: 경고 상태 자동 업데이트
 * 3. **이력 관리**: 입출고, 수리, 폐기 이력 기록
 *
 * 상태 자동 변경 로직:
 * - currentCount >= warningCount -> WARNING
 * - currentCount >= expectedLife -> REPLACE
 * - 교체 등록 시 -> NORMAL (currentCount 리셋)
 *
 * 사용 시나리오:
 * 1. 금형 출고 시: createLog(OUT) + increaseCount
 * 2. 금형 반납 시: createLog(RETURN)
 * 3. 금형 교체 시: registerReplacement -> createLog(IN)
 * 4. 금형 수리 시: createLog(REPAIR)
 * 5. 금형 폐기 시: createLog(SCRAP) + useYn='N'
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateConsumableDto,
  UpdateConsumableDto,
  ConsumableQueryDto,
  CreateConsumableLogDto,
  ConsumableLogQueryDto,
  IncreaseCountDto,
  RegisterReplacementDto,
} from '../dto/consumable.dto';

@Injectable()
export class ConsumableService {
  private readonly logger = new Logger(ConsumableService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // CRUD 기본 기능
  // =============================================

  /**
   * 소모품 목록 조회 (페이지네이션)
   */
  async findAll(query: ConsumableQueryDto, company?: string) {
    const {
      page = 1,
      limit = 20,
      category,
      status,
      vendor,
      useYn,
      search,
      nextReplaceBefore,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(company && { company }),
      ...(category && { category }),
      ...(status && { status }),
      ...(vendor && { vendor: { contains: vendor, mode: 'insensitive' as const } }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { consumableCode: { contains: search, mode: 'insensitive' as const } },
          { consumableName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
      ...(nextReplaceBefore && {
        nextReplaceAt: { lte: new Date(nextReplaceBefore) },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.consumableMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { consumableCode: 'asc' },
      }),
      this.prisma.consumableMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 소모품 단건 조회 (ID)
   */
  async findById(id: string) {
    const consumable = await this.prisma.consumableMaster.findFirst({
      where: { id, deletedAt: null },
      include: {
        consumableLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            worker: {
              select: { id: true, name: true, empNo: true },
            },
          },
        },
      },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${id}`);
    }

    return consumable;
  }

  /**
   * 소모품 단건 조회 (코드)
   */
  async findByCode(consumableCode: string) {
    const consumable = await this.prisma.consumableMaster.findFirst({
      where: { consumableCode, deletedAt: null },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${consumableCode}`);
    }

    return consumable;
  }

  /**
   * 소모품 생성
   */
  async create(dto: CreateConsumableDto) {
    // 중복 코드 확인
    const existing = await this.prisma.consumableMaster.findFirst({
      where: { consumableCode: dto.consumableCode, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 소모품 코드입니다: ${dto.consumableCode}`);
    }

    return this.prisma.consumableMaster.create({
      data: {
        consumableCode: dto.consumableCode,
        consumableName: dto.name,
        category: dto.category,
        expectedLife: dto.expectedLife,
        currentCount: dto.currentCount ?? 0,
        warningCount: dto.warningCount,
        location: dto.location,
        lastReplaceAt: dto.lastReplaceAt ? new Date(dto.lastReplaceAt) : null,
        nextReplaceAt: dto.nextReplaceAt ? new Date(dto.nextReplaceAt) : null,
        unitPrice: dto.unitPrice,
        vendor: dto.vendor,
        status: dto.status ?? 'NORMAL',
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  /**
   * 소모품 수정
   */
  async update(id: string, dto: UpdateConsumableDto) {
    await this.findById(id);

    // 코드 변경 시 중복 확인
    if (dto.consumableCode) {
      const existing = await this.prisma.consumableMaster.findFirst({
        where: {
          consumableCode: dto.consumableCode,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`이미 존재하는 소모품 코드입니다: ${dto.consumableCode}`);
      }
    }

    const updated = await this.prisma.consumableMaster.update({
      where: { id },
      data: {
        ...(dto.consumableCode !== undefined && { consumableCode: dto.consumableCode }),
        ...(dto.name !== undefined && { consumableName: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.expectedLife !== undefined && { expectedLife: dto.expectedLife }),
        ...(dto.currentCount !== undefined && { currentCount: dto.currentCount }),
        ...(dto.warningCount !== undefined && { warningCount: dto.warningCount }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.lastReplaceAt !== undefined && {
          lastReplaceAt: dto.lastReplaceAt ? new Date(dto.lastReplaceAt) : null,
        }),
        ...(dto.nextReplaceAt !== undefined && {
          nextReplaceAt: dto.nextReplaceAt ? new Date(dto.nextReplaceAt) : null,
        }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.vendor !== undefined && { vendor: dto.vendor }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.useYn !== undefined && { useYn: dto.useYn }),
      },
    });

    // 상태 자동 업데이트
    await this.updateWarningStatus(id);

    return this.findById(id);
  }

  /**
   * 소모품 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    await this.findById(id);

    return this.prisma.consumableMaster.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // =============================================
  // 수명 관리
  // =============================================

  /**
   * 사용 횟수 증가
   */
  async increaseCount(id: string, dto: IncreaseCountDto) {
    const consumable = await this.findById(id);
    const newCount = consumable.currentCount + dto.count;

    await this.prisma.consumableMaster.update({
      where: { id },
      data: { currentCount: newCount },
    });

    // 상태 자동 업데이트
    await this.updateWarningStatus(id);

    this.logger.log(
      `소모품 사용 횟수 증가: ${consumable.consumableCode} (${consumable.currentCount} -> ${newCount})`
    );

    return this.findById(id);
  }

  /**
   * 교체 등록
   */
  async registerReplacement(id: string, dto: RegisterReplacementDto) {
    const consumable = await this.findById(id);

    // 트랜잭션으로 처리
    const [updated, log] = await this.prisma.$transaction([
      // 소모품 정보 업데이트
      this.prisma.consumableMaster.update({
        where: { id },
        data: {
          currentCount: 0,
          lastReplaceAt: new Date(),
          nextReplaceAt: dto.nextReplaceAt ? new Date(dto.nextReplaceAt) : null,
          status: 'NORMAL',
        },
      }),
      // 입고 로그 생성
      this.prisma.consumableLog.create({
        data: {
          consumableId: id,
          logType: 'IN',
          qty: 1,
          workerId: dto.workerId,
          remark: dto.remark ?? '교체 입고',
        },
      }),
    ]);

    this.logger.log(
      `소모품 교체 등록: ${consumable.consumableCode}, 이전 사용 횟수: ${consumable.currentCount}`
    );

    return this.findById(id);
  }

  /**
   * 경고 상태 자동 업데이트
   */
  async updateWarningStatus(id: string) {
    const consumable = await this.prisma.consumableMaster.findUnique({
      where: { id },
    });

    if (!consumable) return;

    let newStatus = 'NORMAL';

    if (consumable.expectedLife && consumable.currentCount >= consumable.expectedLife) {
      newStatus = 'REPLACE';
    } else if (consumable.warningCount && consumable.currentCount >= consumable.warningCount) {
      newStatus = 'WARNING';
    }

    if (consumable.status !== newStatus) {
      await this.prisma.consumableMaster.update({
        where: { id },
        data: { status: newStatus },
      });

      this.logger.log(
        `소모품 상태 자동 변경: ${consumable.consumableCode} (${consumable.status} -> ${newStatus})`
      );
    }
  }

  // =============================================
  // 소모품 로그 관리
  // =============================================

  /**
   * 소모품 로그 생성
   */
  async createLog(dto: CreateConsumableLogDto) {
    // 소모품 존재 확인
    const consumable = await this.findById(dto.consumableId);

    const log = await this.prisma.consumableLog.create({
      data: {
        consumableId: dto.consumableId,
        logType: dto.logType,
        qty: dto.qty ?? 1,
        workerId: dto.workerId,
        remark: dto.remark,
      },
      include: {
        worker: {
          select: { id: true, name: true, empNo: true },
        },
        consumable: {
          select: { consumableCode: true, consumableName: true },
        },
      },
    });

    // SCRAP인 경우 소모품 비활성화
    if (dto.logType === 'SCRAP') {
      await this.prisma.consumableMaster.update({
        where: { id: dto.consumableId },
        data: { useYn: 'N' },
      });

      this.logger.log(`소모품 폐기 처리: ${consumable.consumableCode}`);
    }

    return log;
  }

  /**
   * 소모품 로그 목록 조회
   */
  async findLogs(query: ConsumableLogQueryDto) {
    const {
      page = 1,
      limit = 20,
      consumableId,
      logType,
      startDate,
      endDate,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(consumableId && { consumableId }),
      ...(logType && { logType }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: new Date(startDate) }),
              ...(endDate && { lte: new Date(endDate) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.consumableLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          worker: {
            select: { id: true, name: true, empNo: true },
          },
          consumable: {
            select: { consumableCode: true, consumableName: true, category: true },
          },
        },
      }),
      this.prisma.consumableLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 특정 소모품의 로그 조회
   */
  async findLogsByConsumableId(consumableId: string) {
    await this.findById(consumableId); // 존재 확인

    return this.prisma.consumableLog.findMany({
      where: { consumableId },
      orderBy: { createdAt: 'desc' },
      include: {
        worker: {
          select: { id: true, name: true, empNo: true },
        },
      },
    });
  }

  // =============================================
  // 필터링 조회
  // =============================================

  /**
   * 카테고리별 소모품 목록 조회
   */
  async findByCategory(category: string) {
    return this.prisma.consumableMaster.findMany({
      where: { category, useYn: 'Y', deletedAt: null },
      orderBy: { consumableCode: 'asc' },
    });
  }

  /**
   * 교체 예정 목록 조회
   */
  async findReplacementSchedule(days: number = 30) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    return this.prisma.consumableMaster.findMany({
      where: {
        deletedAt: null,
        useYn: 'Y',
        OR: [
          { status: { in: ['WARNING', 'REPLACE'] } },
          { nextReplaceAt: { lte: targetDate } },
        ],
      },
      orderBy: [
        { status: 'desc' }, // REPLACE > WARNING > NORMAL
        { nextReplaceAt: 'asc' },
      ],
    });
  }

  /**
   * 경고/교체필요 상태 소모품 목록 조회
   */
  async findWarningConsumables() {
    return this.prisma.consumableMaster.findMany({
      where: {
        status: { in: ['WARNING', 'REPLACE'] },
        useYn: 'Y',
        deletedAt: null,
      },
      orderBy: { status: 'desc' },
    });
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 소모품 현황 통계
   */
  async getConsumableStats() {
    const [statusStats, categoryStats, totalCount] = await Promise.all([
      // 상태별 통계
      this.prisma.consumableMaster.groupBy({
        by: ['status'],
        where: { deletedAt: null, useYn: 'Y' },
        _count: { status: true },
      }),
      // 카테고리별 통계
      this.prisma.consumableMaster.groupBy({
        by: ['category'],
        where: { deletedAt: null, useYn: 'Y' },
        _count: { category: true },
      }),
      // 전체 개수
      this.prisma.consumableMaster.count({
        where: { deletedAt: null, useYn: 'Y' },
      }),
    ]);

    return {
      total: totalCount,
      byStatus: statusStats.map((s: any) => ({
        status: s.status,
        count: s._count.status,
      })),
      byCategory: categoryStats.map((c: any) => ({
        category: c.category ?? 'UNKNOWN',
        count: c._count.category,
      })),
    };
  }
}
