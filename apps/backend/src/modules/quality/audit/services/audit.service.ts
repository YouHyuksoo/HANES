/**
 * @file audit.service.ts
 * @description 납품업체심사 서비스
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
import { AuditPlan } from '../../../../entities/audit-plan.entity';
import { AuditFinding } from '../../../../entities/audit-finding.entity';
import { parseDateStart } from '../../../../shared/date.util';
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

  private tenantWhere(company?: string | null, plant?: string | null) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  private assertSameTenant(
    context: string,
    row: { company?: string | null; plant?: string | null },
    company?: string | null,
    plant?: string | null,
  ) {
    if (company && row.company !== company) {
      throw new BadRequestException(`${context} 회사 정보가 일치하지 않습니다. request=${company}, row=${row.company ?? 'NULL'}`);
    }
    if (plant && row.plant !== plant) {
      throw new BadRequestException(`${context} 사업장 정보가 일치하지 않습니다. request=${plant}, row=${row.plant ?? 'NULL'}`);
    }
  }

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
      fromDate,
      toDate,
    } = query;

    const qb = this.auditRepo.createQueryBuilder('a');

    if (company) qb.andWhere('a.company = :company', { company });
    if (plant) qb.andWhere('a.plant = :plant', { plant });
    if (status) qb.andWhere('a.status = :status', { status });
    if (auditType) qb.andWhere('a.auditType = :auditType', { auditType });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(a.auditNo LIKE :sCode OR a.auditScope LIKE :sRaw)',
        { sCode: `%${upper}%`, sRaw: `%${search}%` },
      );
    }
    if (fromDate && toDate) {
      qb.andWhere('a.createdAt BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(`${fromDate}T00:00:00`),
        toDate: new Date(`${toDate}T23:59:59`),
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
  async findById(auditNo: string, company?: string, plant?: string) {
    const item = await this.auditRepo.findOne({ where: { auditNo, ...this.tenantWhere(company, plant) } });
    if (!item) {
      throw new NotFoundException('심사 계획을 찾을 수 없습니다.');
    }
    this.assertSameTenant('심사 계획', item, company, plant);
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
      auditNo,
      auditType: dto.auditType,
      auditScope: dto.auditScope,
      targetDept: dto.targetDept,
      auditor: dto.auditor,
      coAuditor: dto.coAuditor,
      scheduledDate: parseDateStart(dto.scheduledDate)!,
      summary: dto.summary,
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
  async update(auditNo: string, dto: UpdateAuditPlanDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(auditNo, company, plant);
    if (item.status !== 'PLANNED') {
      throw new BadRequestException('계획 상태에서만 수정할 수 있습니다.');
    }
    const updateData: Partial<AuditPlan> = {
      ...(dto.auditType !== undefined ? { auditType: dto.auditType } : {}),
      ...(dto.auditScope !== undefined ? { auditScope: dto.auditScope } : {}),
      ...(dto.targetDept !== undefined ? { targetDept: dto.targetDept } : {}),
      ...(dto.auditor !== undefined ? { auditor: dto.auditor } : {}),
      ...(dto.coAuditor !== undefined ? { coAuditor: dto.coAuditor } : {}),
      ...(dto.scheduledDate !== undefined ? { scheduledDate: parseDateStart(dto.scheduledDate)! } : {}),
      ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
    };
    Object.assign(item, updateData, { updatedBy: userId });
    return this.auditRepo.save(item);
  }

  /**
   * 심사 계획 삭제 (PLANNED 상태에서만 가능)
   */
  async delete(auditNo: string, company?: string, plant?: string) {
    const item = await this.findById(auditNo, company, plant);
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
    auditNo: string,
    overallResult: string,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.findById(auditNo, company, plant);
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
  async close(auditNo: string, userId: string, company?: string, plant?: string) {
    const item = await this.findById(auditNo, company, plant);
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
    await this.findById(dto.auditId, company, plant);

    // 발견사항 번호 자동 부여
    const lastFinding = await this.findingRepo
      .createQueryBuilder('f')
      .where('f.auditId = :auditId', { auditId: dto.auditId })
      .orderBy('f.findingNo', 'DESC')
      .getOne();

    const findingNo = lastFinding ? lastFinding.findingNo + 1 : 1;

    const entity = this.findingRepo.create({
      auditId: dto.auditId,
      findingNo,
      clauseRef: dto.clauseRef,
      category: dto.category,
      description: dto.description,
      evidence: dto.evidence,
      dueDate: dto.dueDate ? parseDateStart(dto.dueDate)! : undefined,
      remark: dto.remark,
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
  async getFindings(auditId: string, company?: string, plant?: string) {
    return this.findingRepo.find({
      where: { auditId, ...this.tenantWhere(company, plant) },
      order: { findingNo: 'ASC' },
    });
  }

  /**
   * 발견사항에 CAPA 연결
   */
  async linkCapa(auditId: string, findingNo: number, capaId: string, company?: string, plant?: string) {
    const finding = await this.findingRepo.findOne({
      where: { auditId, findingNo, ...this.tenantWhere(company, plant) },
    });
    if (!finding) {
      throw new NotFoundException('발견사항을 찾을 수 없습니다.');
    }
    this.assertSameTenant('심사 발견사항', finding, company, plant);
    finding.capaId = capaId;
    finding.status = 'IN_PROGRESS';
    const saved = await this.findingRepo.save(finding);
    this.logger.log(
      `CAPA 연결: auditId=${auditId}, findingNo=${findingNo}, capaId=${capaId}`,
    );
    return saved;
  }
}
