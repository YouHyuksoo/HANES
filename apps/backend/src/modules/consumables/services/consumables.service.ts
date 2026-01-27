/**
 * @file src/modules/consumables/services/consumables.service.ts
 * @description 소모품관리 비즈니스 로직 서비스
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
  UpdateShotCountDto,
  ResetShotCountDto,
} from '../dto/consumables.dto';

@Injectable()
export class ConsumablesService {
  private readonly logger = new Logger(ConsumablesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // 소모품 마스터
  // ============================================================================

  async findAll(query: ConsumableQueryDto) {
    const { page = 1, limit = 10, category, status, search, useYn } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(category && { category }),
      ...(status && { status }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { consumableCode: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.consumableMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.consumableMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    const consumable = await this.prisma.consumableMaster.findUnique({
      where: { id },
      include: {
        consumableLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!consumable) {
      throw new NotFoundException(`소모품을 찾을 수 없습니다: ${id}`);
    }

    return consumable;
  }

  async create(dto: CreateConsumableDto) {
    const existing = await this.prisma.consumableMaster.findUnique({
      where: { consumableCode: dto.consumableCode },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 소모품 코드입니다: ${dto.consumableCode}`);
    }

    return this.prisma.consumableMaster.create({
      data: {
        consumableCode: dto.consumableCode,
        name: dto.name,
        category: dto.category,
        expectedLife: dto.expectedLife,
        warningCount: dto.warningCount,
        location: dto.location,
        unitPrice: dto.unitPrice,
        vendor: dto.vendor,
      },
    });
  }

  async update(id: string, dto: UpdateConsumableDto) {
    await this.findById(id);

    // 상태 자동 계산
    let status = dto.status;
    if (dto.currentCount !== undefined) {
      const consumable = await this.prisma.consumableMaster.findUnique({
        where: { id },
      });
      if (consumable?.expectedLife && consumable?.warningCount) {
        if (dto.currentCount >= consumable.expectedLife) {
          status = 'REPLACE';
        } else if (dto.currentCount >= consumable.warningCount) {
          status = 'WARNING';
        }
      }
    }

    return this.prisma.consumableMaster.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.expectedLife !== undefined && { expectedLife: dto.expectedLife }),
        ...(dto.warningCount !== undefined && { warningCount: dto.warningCount }),
        ...(dto.currentCount !== undefined && { currentCount: dto.currentCount }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.unitPrice !== undefined && { unitPrice: dto.unitPrice }),
        ...(dto.vendor !== undefined && { vendor: dto.vendor }),
        ...(status !== undefined && { status }),
        ...(dto.useYn !== undefined && { useYn: dto.useYn }),
      },
    });
  }

  async delete(id: string) {
    await this.findById(id);

    return this.prisma.consumableMaster.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ============================================================================
  // 입출고 이력
  // ============================================================================

  async findAllLogs(query: ConsumableLogQueryDto) {
    const { page = 1, limit = 10, consumableId, logType, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(consumableId && { consumableId }),
      ...(logType && { logType }),
      ...(startDate && endDate && {
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.consumableLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          consumable: {
            select: {
              consumableCode: true,
              name: true,
              category: true,
            },
          },
          worker: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.consumableLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async createLog(dto: CreateConsumableLogDto) {
    await this.findById(dto.consumableId);

    return this.prisma.consumableLog.create({
      data: {
        consumableId: dto.consumableId,
        logType: dto.logType,
        qty: dto.qty ?? 1,
        workerId: dto.workerId,
        remark: dto.remark,
      },
    });
  }

  // ============================================================================
  // 타수 관리
  // ============================================================================

  async updateShotCount(dto: UpdateShotCountDto) {
    const consumable = await this.findById(dto.consumableId);

    const newCount = consumable.currentCount + dto.addCount;

    // 상태 자동 계산
    let status = consumable.status;
    if (consumable.expectedLife && consumable.warningCount) {
      if (newCount >= consumable.expectedLife) {
        status = 'REPLACE';
      } else if (newCount >= consumable.warningCount) {
        status = 'WARNING';
      }
    }

    return this.prisma.consumableMaster.update({
      where: { id: dto.consumableId },
      data: {
        currentCount: newCount,
        status,
      },
    });
  }

  async resetShotCount(dto: ResetShotCountDto) {
    await this.findById(dto.consumableId);

    // 리셋 이력 기록
    await this.prisma.consumableLog.create({
      data: {
        consumableId: dto.consumableId,
        logType: 'REPAIR',
        qty: 1,
        remark: dto.remark ?? '타수 리셋',
      },
    });

    return this.prisma.consumableMaster.update({
      where: { id: dto.consumableId },
      data: {
        currentCount: 0,
        status: 'NORMAL',
        lastReplace: new Date(),
      },
    });
  }

  // ============================================================================
  // 통계 및 대시보드
  // ============================================================================

  async getSummary() {
    const [total, warning, replace, byCategory] = await Promise.all([
      this.prisma.consumableMaster.count({ where: { useYn: 'Y', deletedAt: null } }),
      this.prisma.consumableMaster.count({ where: { status: 'WARNING', useYn: 'Y', deletedAt: null } }),
      this.prisma.consumableMaster.count({ where: { status: 'REPLACE', useYn: 'Y', deletedAt: null } }),
      this.prisma.consumableMaster.groupBy({
        by: ['category'],
        where: { useYn: 'Y', deletedAt: null },
        _count: { category: true },
      }),
    ]);

    return {
      total,
      warning,
      replace,
      byCategory: byCategory.map((c) => ({
        category: c.category,
        count: c._count.category,
      })),
    };
  }

  async getWarningList() {
    return this.prisma.consumableMaster.findMany({
      where: {
        status: { in: ['WARNING', 'REPLACE'] },
        useYn: 'Y',
        deletedAt: null,
      },
      orderBy: [
        { status: 'desc' }, // REPLACE first
        { currentCount: 'desc' },
      ],
    });
  }

  async getLifeStatus() {
    const consumables = await this.prisma.consumableMaster.findMany({
      where: {
        useYn: 'Y',
        deletedAt: null,
        expectedLife: { not: null },
      },
      select: {
        id: true,
        consumableCode: true,
        name: true,
        category: true,
        currentCount: true,
        expectedLife: true,
        warningCount: true,
        status: true,
      },
    });

    return consumables.map((c) => ({
      ...c,
      lifePercentage: c.expectedLife ? Math.round((c.currentCount / c.expectedLife) * 100) : 0,
      remainingLife: c.expectedLife ? c.expectedLife - c.currentCount : null,
    }));
  }
}
