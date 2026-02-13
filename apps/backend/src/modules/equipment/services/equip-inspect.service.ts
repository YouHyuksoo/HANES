/**
 * @file src/modules/equipment/services/equip-inspect.service.ts
 * @description 설비 점검 비즈니스 로직 서비스 (일상/정기 점검 공용)
 *
 * 초보자 가이드:
 * 1. **CRUD**: 점검 결과 생성/조회/수정/삭제
 * 2. **inspectType**: 'DAILY'(일상), 'PERIODIC'(정기)로 구분
 * 3. EquipInspectLog 테이블 사용
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateEquipInspectDto, UpdateEquipInspectDto, EquipInspectQueryDto } from '../dto/equip-inspect.dto';

@Injectable()
export class EquipInspectService {
  constructor(private readonly prisma: PrismaService) {}

  /** 점검 목록 조회 */
  async findAll(query: EquipInspectQueryDto) {
    const {
      page = 1, limit = 10, equipId, inspectType,
      overallResult, search, inspectDateFrom, inspectDateTo,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(equipId && { equipId }),
      ...(inspectType && { inspectType }),
      ...(overallResult && { overallResult }),
      ...(search && {
        OR: [
          { inspectorName: { contains: search, mode: 'insensitive' as const } },
          { equip: { equipCode: { contains: search, mode: 'insensitive' as const } } },
        ],
      }),
      ...(inspectDateFrom || inspectDateTo
        ? {
            inspectDate: {
              ...(inspectDateFrom && { gte: new Date(inspectDateFrom) }),
              ...(inspectDateTo && { lte: new Date(inspectDateTo) }),
            },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.equipInspectLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { inspectDate: 'desc' },
        include: {
          equip: { select: { id: true, equipCode: true, equipName: true, lineCode: true } },
        },
      }),
      this.prisma.equipInspectLog.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  /** 점검 단건 조회 */
  async findById(id: string) {
    const log = await this.prisma.equipInspectLog.findFirst({
      where: { id },
      include: {
        equip: { select: { id: true, equipCode: true, equipName: true, lineCode: true } },
      },
    });
    if (!log) throw new NotFoundException(`점검 기록을 찾을 수 없습니다: ${id}`);
    return log;
  }

  /** 점검 결과 등록 */
  async create(dto: CreateEquipInspectDto) {
    // 설비 존재 확인
    const equip = await this.prisma.equipMaster.findFirst({
      where: { id: dto.equipId, deletedAt: null },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipId}`);

    return this.prisma.equipInspectLog.create({
      data: {
        equipId: dto.equipId,
        inspectType: dto.inspectType,
        inspectDate: new Date(dto.inspectDate),
        inspectorName: dto.inspectorName,
        overallResult: dto.overallResult ?? 'PASS',
        details: dto.details ?? {},
        remark: dto.remark,
      },
      include: {
        equip: { select: { id: true, equipCode: true, equipName: true, lineCode: true } },
      },
    });
  }

  /** 점검 결과 수정 */
  async update(id: string, dto: UpdateEquipInspectDto) {
    await this.findById(id);

    return this.prisma.equipInspectLog.update({
      where: { id },
      data: {
        ...(dto.equipId !== undefined && { equipId: dto.equipId }),
        ...(dto.inspectType !== undefined && { inspectType: dto.inspectType }),
        ...(dto.inspectDate !== undefined && { inspectDate: new Date(dto.inspectDate) }),
        ...(dto.inspectorName !== undefined && { inspectorName: dto.inspectorName }),
        ...(dto.overallResult !== undefined && { overallResult: dto.overallResult }),
        ...(dto.details !== undefined && { details: dto.details }),
        ...(dto.remark !== undefined && { remark: dto.remark }),
      },
      include: {
        equip: { select: { id: true, equipCode: true, equipName: true, lineCode: true } },
      },
    });
  }

  /** 점검 결과 삭제 */
  async delete(id: string) {
    await this.findById(id);
    return this.prisma.equipInspectLog.delete({ where: { id } });
  }

  /** 점검 통계 요약 */
  async getSummary(inspectType?: string) {
    const where = inspectType ? { inspectType } : {};

    const [total, byResult] = await Promise.all([
      this.prisma.equipInspectLog.count({ where }),
      this.prisma.equipInspectLog.groupBy({
        by: ['overallResult'],
        where,
        _count: { overallResult: true },
      }),
    ]);

    return {
      total,
      byResult: byResult.map((r) => ({ result: r.overallResult, count: r._count.overallResult })),
    };
  }
}
