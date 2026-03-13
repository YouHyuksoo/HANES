/**
 * @file mold.service.ts
 * @description 금형관리 서비스 — 금형 마스터 CRUD 및 타수/보전 관리
 *
 * 초보자 가이드:
 * 1. **금형 CRUD**: 등록, 조회, 수정, 삭제
 * 2. **사용 이력(타수)**: addUsage()로 사용 등록 시 currentShots 자동 누적
 * 3. **보전 관리**: getMaintenanceDue()로 보전 예정 금형 조회
 * 4. **폐기**: retire()로 금형 상태를 RETIRED로 변경
 *
 * 주요 메서드:
 * - findAll(): 목록 조회 (페이지네이션 + 필터)
 * - findById() / create() / update() / delete()
 * - addUsage(): 사용 이력 등록 + currentShots 누적
 * - getMaintenanceDue(): 보전 예정 금형 조회
 * - retire(): 금형 폐기 처리
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MoldMaster } from '../../../entities/mold-master.entity';
import { MoldUsageLog } from '../../../entities/mold-usage-log.entity';
import {
  CreateMoldDto,
  UpdateMoldDto,
  CreateMoldUsageDto,
  MoldQueryDto,
} from '../dto/mold.dto';

@Injectable()
export class MoldService {
  private readonly logger = new Logger(MoldService.name);

  constructor(
    @InjectRepository(MoldMaster)
    private readonly moldRepo: Repository<MoldMaster>,
    @InjectRepository(MoldUsageLog)
    private readonly usageRepo: Repository<MoldUsageLog>,
  ) {}

  // =============================================
  // CRUD
  // =============================================

  /**
   * 금형 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: MoldQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, status, moldType, search } = query;

    const qb = this.moldRepo.createQueryBuilder('m');

    if (company) qb.andWhere('m.company = :company', { company });
    if (plant) qb.andWhere('m.plant = :plant', { plant });
    if (status) qb.andWhere('m.status = :status', { status });
    if (moldType) qb.andWhere('m.moldType = :moldType', { moldType });
    if (search) {
      qb.andWhere(
        '(UPPER(m.moldCode) LIKE UPPER(:s) OR UPPER(m.moldName) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }

    qb.orderBy('m.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 금형 단건 조회
   */
  async findById(id: number) {
    const item = await this.moldRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('금형을 찾을 수 없습니다.');
    }
    return item;
  }

  /**
   * 금형 등록
   */
  async create(
    dto: CreateMoldDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const entity = this.moldRepo.create({
      ...dto,
      currentShots: 0,
      status: 'ACTIVE',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.moldRepo.save(entity);
    this.logger.log(`금형 등록: ${dto.moldCode}`);
    return saved;
  }

  /**
   * 금형 수정
   */
  async update(id: number, dto: UpdateMoldDto, userId: string) {
    const item = await this.findById(id);
    if (item.status === 'SCRAPPED') {
      throw new BadRequestException('폐기된 금형은 수정할 수 없습니다.');
    }
    Object.assign(item, dto, { updatedBy: userId });
    return this.moldRepo.save(item);
  }

  /**
   * 금형 삭제 (사용 이력이 없는 경우만)
   */
  async delete(id: number) {
    const item = await this.findById(id);
    const usageCount = await this.usageRepo.count({
      where: { moldId: id },
    });
    if (usageCount > 0) {
      throw new BadRequestException(
        '사용 이력이 있는 금형은 삭제할 수 없습니다.',
      );
    }
    await this.moldRepo.remove(item);
  }

  // =============================================
  // 사용 이력 (타수)
  // =============================================

  /**
   * 사용 이력 등록 + currentShots 누적
   */
  async addUsage(
    moldId: number,
    dto: CreateMoldUsageDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const mold = await this.findById(moldId);
    if (mold.status !== 'ACTIVE') {
      throw new BadRequestException(
        '활성 상태의 금형만 사용 등록할 수 있습니다.',
      );
    }

    // 사용 이력 저장
    const usage = this.usageRepo.create({
      ...dto,
      moldId,
      company,
      plant,
      createdBy: userId,
    });
    const saved = await this.usageRepo.save(usage);

    // currentShots 누적
    mold.currentShots += dto.shotCount;
    mold.updatedBy = userId;
    await this.moldRepo.save(mold);

    this.logger.log(
      `금형 사용 등록: ${mold.moldCode}, shots=${dto.shotCount}, total=${mold.currentShots}`,
    );
    return saved;
  }

  /**
   * 금형별 사용 이력 조회
   */
  async getUsageLogs(moldId: number) {
    return this.usageRepo.find({
      where: { moldId },
      order: { usageDate: 'DESC' },
    });
  }

  // =============================================
  // 보전 관리
  // =============================================

  /**
   * 보전 예정 금형 조회 (보전 주기 도달 또는 보전일 임박)
   */
  async getMaintenanceDue(company?: string, plant?: string) {
    const qb = this.moldRepo
      .createQueryBuilder('m')
      .where('m.status = :status', { status: 'ACTIVE' })
      .andWhere(
        '(m.maintenanceCycle IS NOT NULL AND m.currentShots >= (m.maintenanceCycle * FLOOR(m.currentShots / m.maintenanceCycle))' +
          ' AND MOD(m.currentShots, m.maintenanceCycle) >= m.maintenanceCycle * 0.9)' +
          ' OR (m.nextMaintenanceDate IS NOT NULL AND m.nextMaintenanceDate <= :futureDate)',
        {
          futureDate: (() => {
            const d = new Date();
            d.setDate(d.getDate() + 7);
            return d;
          })(),
        },
      );

    if (company) qb.andWhere('m.company = :company', { company });
    if (plant) qb.andWhere('m.plant = :plant', { plant });

    qb.orderBy('m.currentShots', 'DESC');
    return qb.getMany();
  }

  // =============================================
  // 폐기
  // =============================================

  /**
   * 금형 폐기 처리 (ACTIVE/MAINTENANCE → RETIRED)
   */
  async retire(id: number, userId: string) {
    const item = await this.findById(id);
    if (['RETIRED', 'SCRAPPED'].includes(item.status)) {
      throw new BadRequestException('이미 폐기/스크랩된 금형입니다.');
    }
    item.status = 'RETIRED';
    item.updatedBy = userId;
    const saved = await this.moldRepo.save(item);
    this.logger.log(`금형 폐기: ${item.moldCode}`);
    return saved;
  }
}
