/**
 * @file src/modules/equipment/services/equip-master.service.ts
 * @description 설비마스터 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 설비 생성, 조회, 수정, 삭제
 * 2. **상태 관리**: NORMAL(정상) / MAINT(정비중) / STOP(가동중지)
 * 3. **조회 기능**:
 *    - 라인별 설비 조회
 *    - 유형별 설비 조회
 *    - 상태별 설비 조회
 *
 * 설비 상태 의미:
 * - NORMAL: 정상 가동 상태
 * - MAINT: 정비/점검 중 (예방정비 또는 고장정비)
 * - STOP: 가동 중지 (장기 미사용 또는 폐기 예정)
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CreateEquipMasterDto,
  UpdateEquipMasterDto,
  EquipMasterQueryDto,
  ChangeEquipStatusDto,
} from '../dto/equip-master.dto';

@Injectable()
export class EquipMasterService {
  private readonly logger = new Logger(EquipMasterService.name);

  constructor(private readonly prisma: PrismaService) {}

  // =============================================
  // CRUD 기본 기능
  // =============================================

  /**
   * 설비 목록 조회 (페이지네이션)
   */
  async findAll(query: EquipMasterQueryDto) {
    const {
      page = 1,
      limit = 20,
      equipType,
      lineCode,
      status,
      useYn,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(equipType && { equipType }),
      ...(lineCode && { lineCode }),
      ...(status && { status }),
      ...(useYn && { useYn }),
      ...(search && {
        OR: [
          { equipCode: { contains: search, mode: 'insensitive' as const } },
          { equipName: { contains: search, mode: 'insensitive' as const } },
          { modelName: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.equipMaster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { equipCode: 'asc' },
      }),
      this.prisma.equipMaster.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 설비 단건 조회 (ID)
   */
  async findById(id: string) {
    const equip = await this.prisma.equipMaster.findFirst({
      where: { id, deletedAt: null },
    });

    if (!equip) {
      throw new NotFoundException(`설비를 찾을 수 없습니다: ${id}`);
    }

    return equip;
  }

  /**
   * 설비 단건 조회 (코드)
   */
  async findByCode(equipCode: string) {
    const equip = await this.prisma.equipMaster.findFirst({
      where: { equipCode, deletedAt: null },
    });

    if (!equip) {
      throw new NotFoundException(`설비를 찾을 수 없습니다: ${equipCode}`);
    }

    return equip;
  }

  /**
   * 설비 생성
   */
  async create(dto: CreateEquipMasterDto) {
    // 중복 코드 확인
    const existing = await this.prisma.equipMaster.findFirst({
      where: { equipCode: dto.equipCode, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 설비 코드입니다: ${dto.equipCode}`);
    }

    return this.prisma.equipMaster.create({
      data: {
        equipCode: dto.equipCode,
        equipName: dto.equipName,
        equipType: dto.equipType,
        modelName: dto.modelName,
        maker: dto.maker,
        lineCode: dto.lineCode,
        ipAddress: dto.ipAddress,
        port: dto.port,
        commType: dto.commType,
        commConfig: dto.commConfig,
        installDate: dto.installDate ? new Date(dto.installDate) : null,
        status: dto.status ?? 'NORMAL',
        useYn: dto.useYn ?? 'Y',
      },
    });
  }

  /**
   * 설비 수정
   */
  async update(id: string, dto: UpdateEquipMasterDto) {
    await this.findById(id);

    // 코드 변경 시 중복 확인
    if (dto.equipCode) {
      const existing = await this.prisma.equipMaster.findFirst({
        where: {
          equipCode: dto.equipCode,
          deletedAt: null,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`이미 존재하는 설비 코드입니다: ${dto.equipCode}`);
      }
    }

    return this.prisma.equipMaster.update({
      where: { id },
      data: {
        ...(dto.equipCode !== undefined && { equipCode: dto.equipCode }),
        ...(dto.equipName !== undefined && { equipName: dto.equipName }),
        ...(dto.equipType !== undefined && { equipType: dto.equipType }),
        ...(dto.modelName !== undefined && { modelName: dto.modelName }),
        ...(dto.maker !== undefined && { maker: dto.maker }),
        ...(dto.lineCode !== undefined && { lineCode: dto.lineCode }),
        ...(dto.ipAddress !== undefined && { ipAddress: dto.ipAddress }),
        ...(dto.port !== undefined && { port: dto.port }),
        ...(dto.commType !== undefined && { commType: dto.commType }),
        ...(dto.commConfig !== undefined && { commConfig: dto.commConfig }),
        ...(dto.installDate !== undefined && {
          installDate: dto.installDate ? new Date(dto.installDate) : null,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.useYn !== undefined && { useYn: dto.useYn }),
      },
    });
  }

  /**
   * 설비 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    await this.findById(id);

    return this.prisma.equipMaster.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // =============================================
  // 상태 관리
  // =============================================

  /**
   * 설비 상태 변경
   */
  async changeStatus(id: string, dto: ChangeEquipStatusDto) {
    const equip = await this.findById(id);

    this.logger.log(
      `설비 상태 변경: ${equip.equipCode} (${equip.status} -> ${dto.status}), 사유: ${dto.reason ?? '없음'}`
    );

    return this.prisma.equipMaster.update({
      where: { id },
      data: { status: dto.status },
    });
  }

  /**
   * 상태별 설비 목록 조회
   */
  async findByStatus(status: string) {
    return this.prisma.equipMaster.findMany({
      where: { status, useYn: 'Y', deletedAt: null },
      orderBy: { equipCode: 'asc' },
    });
  }

  // =============================================
  // 필터링 조회
  // =============================================

  /**
   * 라인별 설비 목록 조회
   */
  async findByLineCode(lineCode: string) {
    return this.prisma.equipMaster.findMany({
      where: { lineCode, useYn: 'Y', deletedAt: null },
      orderBy: { equipCode: 'asc' },
    });
  }

  /**
   * 유형별 설비 목록 조회
   */
  async findByType(equipType: string) {
    return this.prisma.equipMaster.findMany({
      where: { equipType, useYn: 'Y', deletedAt: null },
      orderBy: { equipCode: 'asc' },
    });
  }

  // =============================================
  // 통계 및 현황
  // =============================================

  /**
   * 설비 현황 통계
   */
  async getEquipmentStats() {
    const [statusStats, typeStats, totalCount] = await Promise.all([
      // 상태별 통계
      this.prisma.equipMaster.groupBy({
        by: ['status'],
        where: { deletedAt: null, useYn: 'Y' },
        _count: { status: true },
      }),
      // 유형별 통계
      this.prisma.equipMaster.groupBy({
        by: ['equipType'],
        where: { deletedAt: null, useYn: 'Y' },
        _count: { equipType: true },
      }),
      // 전체 개수
      this.prisma.equipMaster.count({
        where: { deletedAt: null, useYn: 'Y' },
      }),
    ]);

    return {
      total: totalCount,
      byStatus: statusStats.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      byType: typeStats.map((t) => ({
        equipType: t.equipType ?? 'UNKNOWN',
        count: t._count.equipType,
      })),
    };
  }

  /**
   * 정비중/중지 설비 목록 조회
   */
  async getMaintenanceEquipments() {
    return this.prisma.equipMaster.findMany({
      where: {
        status: { in: ['MAINT', 'STOP'] },
        useYn: 'Y',
        deletedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }
}
