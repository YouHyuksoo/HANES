/**
 * @file capa.service.ts
 * @description CAPA 시정/예방조치 서비스 — IATF 16949 10.2 근본원인 분석 및 조치 관리
 *
 * 초보자 가이드:
 * 1. **CAPA CRUD**: 등록, 조회, 수정, 삭제
 * 2. **상태 흐름**: OPEN → ANALYZING → ACTION_PLANNED → IN_PROGRESS → VERIFYING → CLOSED
 * 3. **capaNo 자동채번**: CA-YYYYMMDD-NNN (시정) / PA-YYYYMMDD-NNN (예방)
 * 4. **조치 항목**: 1:N 관계로 개별 추적 가능
 *
 * 주요 메서드:
 * - findAll / findById: 목록/단건 조회 (actions 포함)
 * - create / update / delete: 기본 CRUD
 * - analyze: 원인 분석 완료 (OPEN → ANALYZING)
 * - plan: 조치 계획 등록 (ANALYZING → ACTION_PLANNED)
 * - start: 조치 시작 (ACTION_PLANNED → IN_PROGRESS)
 * - verify: 유효성 검증 (IN_PROGRESS → VERIFYING)
 * - close: 종료 (VERIFYING → CLOSED)
 * - addAction / updateAction: 조치 항목 관리
 * - getStats: 상태별 통계
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CAPARequest } from '../../../../entities/capa-request.entity';
import { CAPAAction } from '../../../../entities/capa-action.entity';
import {
  CreateCapaDto,
  UpdateCapaDto,
  CapaQueryDto,
  AnalyzeCapaDto,
  PlanCapaDto,
  VerifyCapaDto,
  CAPAActionItemDto,
} from '../dto/capa.dto';

@Injectable()
export class CapaService {
  private readonly logger = new Logger(CapaService.name);

  constructor(
    @InjectRepository(CAPARequest)
    private readonly capaRepo: Repository<CAPARequest>,
    @InjectRepository(CAPAAction)
    private readonly actionRepo: Repository<CAPAAction>,
  ) {}

  // =============================================
  // CAPA 번호 자동채번
  // =============================================

  /**
   * CAPA 번호 자동채번: CA-YYYYMMDD-NNN (시정) / PA-YYYYMMDD-NNN (예방)
   */
  private async generateCapaNo(
    company: string,
    plant: string,
    capaType: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const typePrefix = capaType === 'CORRECTIVE' ? 'CA' : 'PA';
    const prefix = `${typePrefix}-${dateStr}-`;

    const last = await this.capaRepo
      .createQueryBuilder('c')
      .where('c.company = :company', { company })
      .andWhere('c.plant = :plant', { plant })
      .andWhere('c.capaNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.capaNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.capaNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // CAPA CRUD
  // =============================================

  /**
   * CAPA 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: CapaQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      status,
      capaType,
      sourceType,
      priority,
      search,
      startDate,
      endDate,
    } = query;

    const qb = this.capaRepo.createQueryBuilder('c');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (status) qb.andWhere('c.status = :status', { status });
    if (capaType) qb.andWhere('c.capaType = :capaType', { capaType });
    if (sourceType) qb.andWhere('c.sourceType = :sourceType', { sourceType });
    if (priority) qb.andWhere('c.priority = :priority', { priority });
    if (search) {
      qb.andWhere(
        '(UPPER(c.capaNo) LIKE UPPER(:s) OR UPPER(c.title) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }
    if (startDate && endDate) {
      qb.andWhere('c.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
      });
    }

    qb.orderBy('c.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * CAPA 단건 조회 (actions 포함)
   */
  async findById(id: number) {
    const item = await this.capaRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');
    }
    const actions = await this.actionRepo.find({
      where: { capaId: id },
      order: { seq: 'ASC' },
    });
    return { ...item, actions };
  }

  /**
   * CAPA 등록
   */
  async create(
    dto: CreateCapaDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const capaNo = await this.generateCapaNo(company, plant, dto.capaType);
    const { actions, ...fields } = dto;

    const entity = this.capaRepo.create({
      ...fields,
      capaNo,
      status: 'OPEN',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.capaRepo.save(entity) as CAPARequest;

    // 조치 항목 생성
    if (actions && actions.length > 0) {
      const actionEntities = actions.map((a) =>
        this.actionRepo.create({
          capaId: saved.id,
          seq: a.seq,
          actionDesc: a.actionDesc,
          responsibleCode: a.responsibleCode ?? null,
          dueDate: a.dueDate ? new Date(a.dueDate) : null,
          status: 'PENDING',
        }),
      );
      await this.actionRepo.save(actionEntities);
    }

    this.logger.log(`CAPA 등록: ${capaNo} (type: ${dto.capaType})`);
    return saved;
  }

  /**
   * CAPA 수정 (OPEN 상태에서만)
   */
  async update(id: number, dto: UpdateCapaDto, userId: string) {
    const item = await this.findById(id);
    if (!['OPEN', 'ANALYZING'].includes(item.status)) {
      throw new BadRequestException('OPEN 또는 ANALYZING 상태에서만 수정할 수 있습니다.');
    }
    const { actions, ...updateFields } = dto;
    Object.assign(item, updateFields, { updatedBy: userId });
    return this.capaRepo.save(item);
  }

  /**
   * CAPA 삭제 (OPEN 상태에서만)
   */
  async delete(id: number) {
    const item = await this.findById(id);
    if (item.status !== 'OPEN') {
      throw new BadRequestException('OPEN 상태에서만 삭제할 수 있습니다.');
    }
    // 조치 항목 먼저 삭제
    await this.actionRepo.delete({ capaId: id });
    await this.capaRepo.remove(item as any);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 원인 분석 완료 (OPEN → ANALYZING)
   */
  async analyze(id: number, dto: AnalyzeCapaDto, userId: string) {
    const item = await this.capaRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');
    if (item.status !== 'OPEN') {
      throw new BadRequestException('OPEN 상태에서만 원인 분석을 등록할 수 있습니다.');
    }
    item.rootCause = dto.rootCause;
    item.status = 'ANALYZING';
    item.updatedBy = userId;
    return this.capaRepo.save(item);
  }

  /**
   * 조치 계획 등록 (ANALYZING → ACTION_PLANNED)
   */
  async plan(id: number, dto: PlanCapaDto, userId: string) {
    const item = await this.capaRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');
    if (item.status !== 'ANALYZING') {
      throw new BadRequestException('ANALYZING 상태에서만 조치 계획을 등록할 수 있습니다.');
    }
    item.actionPlan = dto.actionPlan;
    if (dto.targetDate) item.targetDate = new Date(dto.targetDate);
    item.status = 'ACTION_PLANNED';
    item.updatedBy = userId;
    return this.capaRepo.save(item);
  }

  /**
   * 조치 시작 (ACTION_PLANNED → IN_PROGRESS)
   */
  async start(id: number, userId: string) {
    const item = await this.capaRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');
    if (item.status !== 'ACTION_PLANNED') {
      throw new BadRequestException('ACTION_PLANNED 상태에서만 조치를 시작할 수 있습니다.');
    }
    item.status = 'IN_PROGRESS';
    item.updatedBy = userId;
    return this.capaRepo.save(item);
  }

  /**
   * 유효성 검증 (IN_PROGRESS → VERIFYING)
   */
  async verify(id: number, dto: VerifyCapaDto, userId: string) {
    const item = await this.capaRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');
    if (item.status !== 'IN_PROGRESS') {
      throw new BadRequestException('IN_PROGRESS 상태에서만 검증할 수 있습니다.');
    }
    item.verificationResult = dto.verificationResult;
    item.verifiedBy = userId;
    item.verifiedAt = new Date();
    item.status = 'VERIFYING';
    item.updatedBy = userId;
    return this.capaRepo.save(item);
  }

  /**
   * 종료 (VERIFYING → CLOSED)
   */
  async close(id: number, userId: string) {
    const item = await this.capaRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');
    if (item.status !== 'VERIFYING') {
      throw new BadRequestException('VERIFYING 상태에서만 종료할 수 있습니다.');
    }
    item.status = 'CLOSED';
    item.closedAt = new Date();
    item.updatedBy = userId;
    return this.capaRepo.save(item);
  }

  // =============================================
  // 조치 항목 관리
  // =============================================

  /**
   * 조치 항목 추가
   */
  async addAction(capaId: number, dto: CAPAActionItemDto, userId: string) {
    const capa = await this.capaRepo.findOne({ where: { id: capaId } });
    if (!capa) throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');

    const entity = this.actionRepo.create({
      capaId,
      seq: dto.seq,
      actionDesc: dto.actionDesc,
      responsibleCode: dto.responsibleCode ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: dto.status ?? 'PENDING',
    });
    capa.updatedBy = userId;
    await this.capaRepo.save(capa);
    return this.actionRepo.save(entity);
  }

  /**
   * 조치 항목 수정
   */
  async updateAction(
    capaId: number,
    actionSeq: number,
    dto: Partial<CAPAActionItemDto>,
    userId: string,
  ) {
    const action = await this.actionRepo.findOne({
      where: { capaId, seq: actionSeq },
    });
    if (!action) {
      throw new NotFoundException('조치 항목을 찾을 수 없습니다.');
    }

    if (dto.actionDesc !== undefined) action.actionDesc = dto.actionDesc;
    if (dto.responsibleCode !== undefined) action.responsibleCode = dto.responsibleCode;
    if (dto.dueDate !== undefined) action.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.status !== undefined) {
      action.status = dto.status;
      if (dto.status === 'DONE') action.completedAt = new Date();
    }
    if (dto.result !== undefined) action.result = dto.result;

    // CAPA updatedBy 갱신
    await this.capaRepo.update({ id: capaId }, { updatedBy: userId });
    return this.actionRepo.save(action);
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 상태별 통계 (건수)
   */
  async getStats(company?: string, plant?: string) {
    const qb = this.capaRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('c.capaType', 'capaType')
      .addSelect('COUNT(*)', 'count');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });

    qb.groupBy('c.status').addGroupBy('c.capaType');
    return qb.getRawMany();
  }
}
