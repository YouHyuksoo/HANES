/**
 * @file src/modules/equipment/services/equip-inspect.service.ts
 * @description 설비 점검 비즈니스 로직 서비스 (일상/정기 점검 공용) (TypeORM)
 *
 * 초보자 가이드:
 * 1. **CRUD**: 점검 결과 생성/조회/수정/삭제
 * 2. **inspectType**: 'DAILY'(일상), 'PERIODIC'(정기)로 구분
 * 3. EquipInspectLog 테이블 사용
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { EquipInspectLog } from '../../../entities/equip-inspect-log.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { CreateEquipInspectDto, UpdateEquipInspectDto, EquipInspectQueryDto } from '../dto/equip-inspect.dto';

@Injectable()
export class EquipInspectService {
  constructor(
    @InjectRepository(EquipInspectLog)
    private readonly equipInspectLogRepository: Repository<EquipInspectLog>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepository: Repository<EquipMaster>,
  ) {}

  /** 점검 목록 조회 */
  async findAll(query: EquipInspectQueryDto) {
    const {
      page = 1, limit = 10, equipId, inspectType,
      overallResult, search, inspectDateFrom, inspectDateTo,
    } = query;
    const skip = (page - 1) * limit;

    const queryBuilder = this.equipInspectLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect(EquipMaster, 'equip', 'log.equipId = equip.id')
      .select([
        'log',
        'equip.id AS equip_id',
        'equip.equipCode AS equip_code',
        'equip.equipName AS equip_name',
        'equip.lineCode AS equip_lineCode',
      ]);

    if (equipId) {
      queryBuilder.andWhere('log.equipId = :equipId', { equipId });
    }
    if (inspectType) {
      queryBuilder.andWhere('log.inspectType = :inspectType', { inspectType });
    }
    if (overallResult) {
      queryBuilder.andWhere('log.overallResult = :overallResult', { overallResult });
    }
    if (inspectDateFrom) {
      queryBuilder.andWhere('log.inspectDate >= :inspectDateFrom', { inspectDateFrom: new Date(inspectDateFrom) });
    }
    if (inspectDateTo) {
      queryBuilder.andWhere('log.inspectDate <= :inspectDateTo', { inspectDateTo: new Date(inspectDateTo) });
    }
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(log.inspectorName) LIKE LOWER(:search) OR LOWER(equip.equipCode) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    const [logs, total] = await Promise.all([
      queryBuilder
        .orderBy('log.inspectDate', 'DESC')
        .skip(skip)
        .take(limit)
        .getRawMany(),
      queryBuilder.getCount(),
    ]);

    // Transform raw results to include equip info
    const data = logs.map((log) => ({
      ...log.log,
      equip: {
        id: log.equip_id,
        equipCode: log.equip_code,
        equipName: log.equip_name,
        lineCode: log.equip_lineCode,
      },
    }));

    return { data, total, page, limit };
  }

  /** 점검 단건 조회 */
  async findById(id: string) {
    const log = await this.equipInspectLogRepository.findOne({
      where: { id },
    });

    if (!log) throw new NotFoundException(`점검 기록을 찾을 수 없습니다: ${id}`);

    // Get equip info
    const equip = await this.equipMasterRepository.findOne({
      where: { id: log.equipId },
      select: ['id', 'equipCode', 'equipName', 'lineCode'],
    });

    return {
      ...log,
      equip: equip || null,
    };
  }

  /** 점검 결과 등록 */
  async create(dto: CreateEquipInspectDto) {
    // 설비 존재 확인
    const equip = await this.equipMasterRepository.findOne({
      where: { id: dto.equipId, deletedAt: IsNull() },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipId}`);

    const log = this.equipInspectLogRepository.create({
      equipId: dto.equipId,
      inspectType: dto.inspectType,
      inspectDate: new Date(dto.inspectDate),
      inspectorName: dto.inspectorName,
      overallResult: dto.overallResult ?? 'PASS',
      details: dto.details ? JSON.stringify(dto.details) : null,
      remark: dto.remark,
    });

    const saved = await this.equipInspectLogRepository.save(log);

    return {
      ...saved,
      equip: {
        id: equip.id,
        equipCode: equip.equipCode,
        equipName: equip.equipName,
        lineCode: equip.lineCode,
      },
    };
  }

  /** 점검 결과 수정 */
  async update(id: string, dto: UpdateEquipInspectDto) {
    const log = await this.findById(id);

    const updateData: Partial<EquipInspectLog> = {};

    if (dto.equipId !== undefined) updateData.equipId = dto.equipId;
    if (dto.inspectType !== undefined) updateData.inspectType = dto.inspectType;
    if (dto.inspectDate !== undefined) updateData.inspectDate = new Date(dto.inspectDate);
    if (dto.inspectorName !== undefined) updateData.inspectorName = dto.inspectorName;
    if (dto.overallResult !== undefined) updateData.overallResult = dto.overallResult;
    if (dto.details !== undefined) updateData.details = dto.details ? JSON.stringify(dto.details) : null;
    if (dto.remark !== undefined) updateData.remark = dto.remark;

    await this.equipInspectLogRepository.update(id, updateData);

    // Get equip info for response
    const equip = await this.equipMasterRepository.findOne({
      where: { id: updateData.equipId || log.equipId },
      select: ['id', 'equipCode', 'equipName', 'lineCode'],
    });

    const updated = await this.equipInspectLogRepository.findOne({ where: { id } });

    return {
      ...updated,
      equip: equip || null,
    };
  }

  /** 점검 결과 삭제 */
  async delete(id: string) {
    await this.findById(id);
    await this.equipInspectLogRepository.delete(id);
    return { id, deleted: true };
  }

  /** 점검 통계 요약 */
  async getSummary(inspectType?: string) {
    const queryBuilder = this.equipInspectLogRepository.createQueryBuilder('log');

    if (inspectType) {
      queryBuilder.where('log.inspectType = :inspectType', { inspectType });
    }

    const total = await queryBuilder.getCount();

    const byResult = await this.equipInspectLogRepository
      .createQueryBuilder('log')
      .select('log.overallResult', 'result')
      .addSelect('COUNT(*)', 'count')
      .where(inspectType ? 'log.inspectType = :inspectType' : '1=1', inspectType ? { inspectType } : {})
      .groupBy('log.overallResult')
      .getRawMany();

    return {
      total,
      byResult: byResult.map((r) => ({ result: r.result, count: parseInt(r.count, 10) })),
    };
  }
}
