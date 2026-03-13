/**
 * @file audit.service.ts
 * @description 내부심사 서비스 — IATF 16949 9.2 내부심사
 *
 * 초보자 가이드:
 * 1. **심사 계획 CRUD**: 등록, 조회, 수정, 삭제
 * 2. **발견사항 관리**: 등록, 조회, CAPA 연결
 * 3. **상태 흐름**: PLANNED → IN_PROGRESS → COMPLETED → CLOSED
 * 4. **auditNo 자동채번**: AUD-YYYYMMDD-NNN
 *
 * 주요 메서드:
 * - generateAuditNo(): 자동채번
 * - findAll(): 목록 조회 (페이지네이션 + 필터)
 * - findById() / create() / update() / delete()
 * - complete(): 완료 (IN_PROGRESS → COMPLETED)
 * - close(): 종결 (COMPLETED → CLOSED)
 * - addFinding(): 발견사항 등록
 * - linkCapa(): 발견사항에 CAPA 연결
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditPlan } from '../../../entities/audit-plan.entity';
import { AuditFinding } from '../../../entities/audit-finding.entity';
import {
  CreateAuditPlanDto,
  UpdateAuditPlanDto,
  CreateAuditFindingDto,
  AuditQueryDto,
} from '../dto/audit.dto';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditPlan)
    private readonly auditRepo: Repository<AuditPlan>,
    @InjectRepository(AuditFinding)
    private readonly findingRepo: Repository<AuditFinding>,
  ) {}

  // =============================================
  // 심사번호 자동채번
  // =============================================

  /**
   * 심사번호 자동채번: AUD-YYYYMMDD-NNN
   */
  private async generateAuditNo(
    company: string,
    plant: string,
  ): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `AUD-${dateStr}-`;

    const last = await this.auditRepo
      .createQueryBuilder('a')
      .where('a.company = :company', { company })
      .andWhere('a.plant = :plant', { plant })
      .andWhere('a.auditNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('a.auditNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.auditNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  // =============================================
  // 심사 계획 CRUD
  // =============================================

  /**
   * 심사 계획 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: AuditQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      status,
      auditType,
      search,
      startDate,
      endDate,
    } = query;

    const qb = this.auditRepo.createQueryBuilder('a');

    if (company) qb.andWhere('a.company = :company', { company });
    if (plant) qb.andWhere('a.plant = :plant', { plant });
    if (status) qb.andWhere('a.status = :status', { status });
    if (auditType) qb.andWhere('a.auditType = :auditType', { auditType });
    if (search) {
      qb.andWhere(
        '(UPPER(a.auditNo) LIKE UPPER(:s) OR UPPER(a.auditScope) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }
    if (startDate && endDate) {
      qb.andWhere('a.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
      });
    }

    qb.orderBy('a.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 심사 계획 단건 조회
   */
  async findById(id: number) {
    const item = await this.auditRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('심사 계획을 찾을 수 없습니다.');
    }
    return item;
  }

  /**
   * 심사 계획 등록 (PLANNED 상태로 생성)
   */
  async create(
    dto: CreateAuditPlanDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const auditNo = await this.generateAuditNo(company, plant);
    const entity = this.auditRepo.create({
      ...dto,
      auditNo,
      status: 'PLANNED',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.auditRepo.save(entity);
    this.logger.log(`심사 계획 등록: ${auditNo}`);
    return saved;
  }

  /**
   * 심사 계획 수정 (PLANNED 상태에서만 가능)
   */
  async update(id: number, dto: UpdateAuditPlanDto, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'PLANNED') {
      throw new BadRequestException('계획 상태에서만 수정할 수 있습니다.');
    }
    Object.assign(item, dto, { updatedBy: userId });
    return this.auditRepo.save(item);
  }

  /**
   * 심사 계획 삭제 (PLANNED 상태에서만 가능)
   */
  async delete(id: number) {
    const item = await this.findById(id);
    if (item.status !== 'PLANNED') {
      throw new BadRequestException('계획 상태에서만 삭제할 수 있습니다.');
    }
    await this.auditRepo.remove(item);
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 완료 (IN_PROGRESS → COMPLETED)
   */
  async complete(
    id: number,
    overallResult: string,
    userId: string,
  ) {
    const item = await this.findById(id);
    if (!['PLANNED', 'IN_PROGRESS'].includes(item.status)) {
      throw new BadRequestException(
        '계획 또는 진행중 상태에서만 완료할 수 있습니다.',
      );
    }
    item.status = 'COMPLETED';
    item.overallResult = overallResult;
    item.actualDate = new Date();
    item.updatedBy = userId;
    const saved = await this.auditRepo.save(item);
    this.logger.log(`심사 완료: ${item.auditNo} → ${overallResult}`);
    return saved;
  }

  /**
   * 종결 (COMPLETED → CLOSED)
   */
  async close(id: number, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'COMPLETED') {
      throw new BadRequestException('완료 상태에서만 종결할 수 있습니다.');
    }
    item.status = 'CLOSED';
    item.updatedBy = userId;
    const saved = await this.auditRepo.save(item);
    this.logger.log(`심사 종결: ${item.auditNo}`);
    return saved;
  }

  // =============================================
  // 발견사항
  // =============================================

  /**
   * 발견사항 등록
   */
  async addFinding(
    dto: CreateAuditFindingDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    await this.findById(dto.auditId);

    // 발견사항 번호 자동 부여
    const lastFinding = await this.findingRepo
      .createQueryBuilder('f')
      .where('f.auditId = :auditId', { auditId: dto.auditId })
      .orderBy('f.findingNo', 'DESC')
      .getOne();

    const findingNo = lastFinding ? lastFinding.findingNo + 1 : 1;

    const entity = this.findingRepo.create({
      ...dto,
      findingNo,
      status: 'OPEN',
      company,
      plant,
      createdBy: userId,
    });
    const saved = await this.findingRepo.save(entity);
    this.logger.log(
      `발견사항 등록: auditId=${dto.auditId}, #${findingNo}`,
    );
    return saved;
  }

  /**
   * 심사별 발견사항 조회
   */
  async getFindings(auditId: number) {
    return this.findingRepo.find({
      where: { auditId },
      order: { findingNo: 'ASC' },
    });
  }

  /**
   * 발견사항에 CAPA 연결
   */
  async linkCapa(findingId: number, capaId: number) {
    const finding = await this.findingRepo.findOne({
      where: { id: findingId },
    });
    if (!finding) {
      throw new NotFoundException('발견사항을 찾을 수 없습니다.');
    }
    finding.capaId = capaId;
    finding.status = 'IN_PROGRESS';
    const saved = await this.findingRepo.save(finding);
    this.logger.log(
      `CAPA 연결: findingId=${findingId}, capaId=${capaId}`,
    );
    return saved;
  }
}
