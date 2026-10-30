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
import { parseDateEnd, parseDateStart } from '../../../../shared/date.util';
import { NumberingService } from '../../../../shared/numbering.service';
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
    private readonly numbering: NumberingService,
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

  /** 공통코드(사용 중)에 있는 값인지 확인한다 */
  private async assertComCode(group: string, code: string, company: string, plant: string, label: string): Promise<void> {
    const rows: Array<{ cnt: number | string }> = await this.auditRepo.manager.query(
      `SELECT COUNT(*) AS "cnt" FROM COM_CODES
        WHERE GROUP_CODE = :1 AND DETAIL_CODE = :2 AND USE_YN = 'Y' AND COMPANY = :3 AND PLANT_CD = :4`,
      [group, code, company, plant],
    );
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      throw new BadRequestException(`${label} 값이 공통코드(${group})에 없습니다: ${code}`);
    }
  }

  // =============================================
  // 심사번호 자동채번
  // =============================================

  /**
   * 심사번호 자동채번: AUD-YYYYMMDD-NNN
   * NUM_RULE_MASTERS(AUDIT_NO) 행을 SELECT FOR UPDATE로 잠가 동시 채번을 직렬화한다.
   */
  private async generateAuditNo(): Promise<string> {
    return this.numbering.next('AUDIT_NO');
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
    // 시작일·종료일은 하나만 와도 걸린다(둘 다 있어야 걸리면 하나만 보냈을 때 구간이 통째로 사라졌고, ISO 시각은 날짜 변환이 깨졌다)
    const from = parseDateStart(fromDate);
    const to = parseDateEnd(toDate);
    if (from) qb.andWhere('a.createdAt >= :fromDate', { fromDate: from });
    if (to) qb.andWhere('a.createdAt <= :toDate', { toDate: to });

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
    const auditNo = await this.generateAuditNo();
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
      // 비울 수 없는 칸(유형·범위·주 심사원·예정일)에 null 이 오면 그대로 둔다(저장 시 NOT NULL 오류 500)
      ...(dto.auditType != null ? { auditType: dto.auditType } : {}),
      ...(dto.auditScope != null ? { auditScope: dto.auditScope } : {}),
      ...(dto.targetDept !== undefined ? { targetDept: dto.targetDept } : {}),
      ...(dto.auditor != null ? { auditor: dto.auditor } : {}),
      ...(dto.coAuditor !== undefined ? { coAuditor: dto.coAuditor } : {}),
      ...(dto.scheduledDate != null ? { scheduledDate: parseDateStart(dto.scheduledDate)! } : {}),
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
    // 심사 계획을 지우면 발견사항도 함께 지운다(발견사항이 심사 없이 남던 것)
    await this.auditRepo.manager.transaction(async (manager) => {
      await manager.getRepository(AuditFinding).delete({ auditId: auditNo, ...this.tenantWhere(item.company, item.plant) });
      await manager.getRepository(AuditPlan).remove(item);
    });
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
    if (overallResult) {
      await this.assertComCode('AUDIT_RESULT', overallResult, item.company, item.plant, '종합 결과');
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
    const audit = await this.findById(dto.auditId, company, plant);
    // 완료·종결된 심사의 결과 기록이 바뀌지 않게 계획/진행 상태에서만 등록한다
    if (!['PLANNED', 'IN_PROGRESS'].includes(audit.status)) {
      throw new BadRequestException('계획 또는 진행중 상태의 심사에서만 발견사항을 등록할 수 있습니다.');
    }

    // 심사 행을 잠근 뒤 번호를 정한다(잠금 없이 정하면 동시에 등록할 때 같은 번호가 나와 save 가 기존 발견사항을 덮어썼다)
    const saved = await this.auditRepo.manager.transaction(async (manager) => {
      await manager.query(
        'SELECT 1 FROM AUDIT_PLANS WHERE AUDIT_NO = :1 AND COMPANY = :2 AND PLANT_CD = :3 FOR UPDATE',
        [audit.auditNo, audit.company, audit.plant],
      );
      const findingRepo = manager.getRepository(AuditFinding);

      // 발견사항 번호 자동 부여
      const lastFinding = await findingRepo
        .createQueryBuilder('f')
        .where('f.auditId = :auditId', { auditId: dto.auditId })
        .orderBy('f.findingNo', 'DESC')
        .getOne();

      const findingNo = lastFinding ? lastFinding.findingNo + 1 : 1;

      const entity = findingRepo.create({
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
      return findingRepo.save(entity);
    });
    this.logger.log(
      `발견사항 등록: auditId=${dto.auditId}, #${saved.findingNo}`,
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
    // CAPA 번호가 있고 같은 회사·사업장에 실제로 있어야 한다(아무 값이나 저장하고 번호가 빠져도 상태만 바뀌던 것)
    if (!capaId?.trim()) {
      throw new BadRequestException('연결할 CAPA 번호가 없습니다.');
    }
    if (finding.status === 'CLOSED') {
      throw new BadRequestException('종결된 발견사항에는 CAPA 를 연결할 수 없습니다.');
    }
    const capaRows: Array<{ cnt: number | string }> = await this.auditRepo.manager.query(
      'SELECT COUNT(*) AS "cnt" FROM CAPA_REQUESTS WHERE CAPA_NO = :1 AND COMPANY = :2 AND PLANT_CD = :3',
      [capaId, finding.company, finding.plant],
    );
    if (Number(capaRows[0]?.cnt ?? 0) === 0) {
      throw new NotFoundException(`시정조치(CAPA)를 찾을 수 없습니다: ${capaId}`);
    }
    finding.capaId = capaId;
    finding.status = 'IN_PROGRESS';
    const saved = await this.findingRepo.save(finding);
    this.logger.log(
      `CAPA 연결: auditId=${auditId}, findingNo=${findingNo}, capaId=${capaId}`,
    );
    return saved;
  }
}
