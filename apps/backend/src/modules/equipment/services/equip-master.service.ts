/**
 * @file src/modules/equipment/services/equip-master.service.ts
 * @description 설비마스터 비즈니스 로직 서비스 (TypeORM)
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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { EquipMaster } from '../../../entities/equip-master.entity';
import { ProdLineMaster } from '../../../entities/prod-line-master.entity';
import { ProcessMaster } from '../../../entities/process-master.entity';
import {
  CreateEquipMasterDto,
  UpdateEquipMasterDto,
  EquipMasterQueryDto,
  ChangeEquipStatusDto,
  AssignJobOrderDto,
} from '../dto/equip-master.dto';

@Injectable()
export class EquipMasterService {
  private readonly logger = new Logger(EquipMasterService.name);

  constructor(
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepository: Repository<EquipMaster>,
    @InjectRepository(ProdLineMaster)
    private readonly lineRepository: Repository<ProdLineMaster>,
    @InjectRepository(ProcessMaster)
    private readonly processRepository: Repository<ProcessMaster>,
  ) {}

  // =============================================
  // CRUD 기본 기능
  // =============================================

  /**
   * 설비 목록 조회 (페이지네이션)
   * - 검색어 필터링을 DB 레벨 QueryBuilder WHERE/LIKE로 처리
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
      company,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.equipMasterRepository.createQueryBuilder('e');

    if (equipType) qb.andWhere('e.equipType = :equipType', { equipType });
    if (lineCode) qb.andWhere('e.lineCode = :lineCode', { lineCode });
    if (status) qb.andWhere('e.status = :status', { status });
    if (useYn) qb.andWhere('e.useYn = :useYn', { useYn });
    if (company) qb.andWhere('e.company = :company', { company });
    if (query.plant) qb.andWhere('e.plant = :plant', { plant: query.plant });

    if (search) {
      qb.andWhere(
        '(LOWER(e.equipCode) LIKE :search OR LOWER(e.equipName) LIKE :search OR LOWER(e.modelName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [data, total] = await Promise.all([
      qb.clone()
        .orderBy('e.equipCode', 'ASC')
        .skip(skip)
        .take(limit)
        .getMany(),
      qb.clone().getCount(),
    ]);

    return { data, total, page, limit };
  }

  /**
   * 설비 단건 조회 (ID)
   */
  async findById(id: string) {
    const equip = await this.equipMasterRepository.findOne({
      where: { id },
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
    const equip = await this.equipMasterRepository.findOne({
      where: { equipCode },
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
    const existing = await this.equipMasterRepository.findOne({
      where: { equipCode: dto.equipCode },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 설비 코드입니다: ${dto.equipCode}`);
    }

    const equip = this.equipMasterRepository.create({
      equipCode: dto.equipCode,
      equipName: dto.equipName,
      equipType: dto.equipType,
      modelName: dto.modelName,
      maker: dto.maker,
      lineCode: dto.lineCode,
      processCode: dto.processCode,
      ipAddress: dto.ipAddress,
      port: dto.port,
      commType: dto.commType,
      commConfig: dto.commConfig ? JSON.stringify(dto.commConfig) : null,
      installDate: dto.installDate ? new Date(dto.installDate) : null,
      status: dto.status ?? 'NORMAL',
      useYn: dto.useYn ?? 'Y',
    });

    return this.equipMasterRepository.save(equip);
  }

  /**
   * 설비 수정
   */
  async update(id: string, dto: UpdateEquipMasterDto) {
    await this.findById(id);

    // 코드 변경 시 중복 확인
    if (dto.equipCode) {
      const existing = await this.equipMasterRepository.findOne({
        where: {
          equipCode: dto.equipCode,
          id: id, // exclude current id
        },
      });

      if (existing) {
        throw new ConflictException(`이미 존재하는 설비 코드입니다: ${dto.equipCode}`);
      }
    }

    const updateData: Partial<EquipMaster> = {};

    if (dto.equipCode !== undefined) updateData.equipCode = dto.equipCode;
    if (dto.equipName !== undefined) updateData.equipName = dto.equipName;
    if (dto.equipType !== undefined) updateData.equipType = dto.equipType;
    if (dto.modelName !== undefined) updateData.modelName = dto.modelName;
    if (dto.maker !== undefined) updateData.maker = dto.maker;
    if (dto.lineCode !== undefined) updateData.lineCode = dto.lineCode;
    if (dto.processCode !== undefined) updateData.processCode = dto.processCode;
    if (dto.ipAddress !== undefined) updateData.ipAddress = dto.ipAddress;
    if (dto.port !== undefined) updateData.port = dto.port;
    if (dto.commType !== undefined) updateData.commType = dto.commType;
    if (dto.commConfig !== undefined) updateData.commConfig = dto.commConfig ? JSON.stringify(dto.commConfig) : null;
    if (dto.installDate !== undefined) updateData.installDate = dto.installDate ? new Date(dto.installDate) : null;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.useYn !== undefined) updateData.useYn = dto.useYn;

    await this.equipMasterRepository.update(id, updateData);
    return this.findById(id);
  }

  /**
   * 설비 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    await this.findById(id);

    await this.equipMasterRepository.delete(id);
    return { id, deleted: true };
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

    await this.equipMasterRepository.update(id, { status: dto.status });
    return this.findById(id);
  }

  /**
   * 상태별 설비 목록 조회
   */
  async findByStatus(status: string) {
    return this.equipMasterRepository.find({
      where: { status, useYn: 'Y' },
      order: { equipCode: 'ASC' },
    });
  }

  // =============================================
  // 필터링 조회
  // =============================================

  /**
   * 라인별 설비 목록 조회
   */
  async findByLineCode(lineCode: string) {
    return this.equipMasterRepository.find({
      where: { lineCode, useYn: 'Y' },
      order: { equipCode: 'ASC' },
    });
  }

  /**
   * 유형별 설비 목록 조회
   */
  async findByType(equipType: string) {
    return this.equipMasterRepository.find({
      where: { equipType, useYn: 'Y' },
      order: { equipCode: 'ASC' },
    });
  }

  // =============================================
  // 통계 및 현황
  // =============================================

  /**
   * 설비 현황 통계
   */
  async getEquipmentStats() {
    // 상태별 통계
    const statusStats = await this.equipMasterRepository
      .createQueryBuilder('equip')
      .select('equip.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('equip.useYn = :useYn', { useYn: 'Y' })
      .groupBy('equip.status')
      .getRawMany();

    // 유형별 통계
    const typeStats = await this.equipMasterRepository
      .createQueryBuilder('equip')
      .select('equip.equipType', 'equipType')
      .addSelect('COUNT(*)', 'count')
      .where('equip.useYn = :useYn', { useYn: 'Y' })
      .groupBy('equip.equipType')
      .getRawMany();

    // 전체 개수
    const totalCount = await this.equipMasterRepository.count({
      where: { useYn: 'Y' },
    });

    return {
      total: totalCount,
      byStatus: statusStats.map((s) => ({
        status: s.status,
        count: parseInt(s.count, 10),
      })),
      byType: typeStats.map((t) => ({
        equipType: t.equipType ?? 'UNKNOWN',
        count: parseInt(t.count, 10),
      })),
    };
  }

  /**
   * 정비중/중지 설비 목록 조회
   */
  async getMaintenanceEquipments() {
    return this.equipMasterRepository.find({
      where: {
        status: In(['MAINT', 'STOP']),
        useYn: 'Y',
      },
      order: { updatedAt: 'DESC' },
    });
  }

  // =============================================
  // 라인 및 공정 정보
  // =============================================

  /**
   * 라인 목록 조회 (설비 선택용)
   */
  async getLines() {
    return this.lineRepository.find({
      where: { useYn: 'Y' },
      select: ['lineCode', 'lineName', 'lineType', 'oper'],
      order: { lineCode: 'ASC' },
    });
  }

  /**
   * 공정 목록 조회 (설비 선택용)
   */
  async getProcesses() {
    return this.processRepository.find({
      where: { useYn: 'Y' },
      select: ['processCode', 'processName', 'processType', 'processCategory'],
      order: { sortOrder: 'ASC', processCode: 'ASC' },
    });
  }

  // =============================================
  // 작업지시 할당
  // =============================================

  /**
   * 설비에 작업지시 할당/해제
   */
  async assignJobOrder(id: string, dto: AssignJobOrderDto) {
    const equip = await this.findById(id);

    await this.equipMasterRepository.update(id, {
      currentJobOrderId: dto.orderNo ?? null,
    });

    this.logger.log(
      dto.orderNo
        ? `설비 작업지시 할당: ${equip.equipCode} → ${dto.orderNo}`
        : `설비 작업지시 해제: ${equip.equipCode}`,
    );

    return this.findById(id);
  }
}
