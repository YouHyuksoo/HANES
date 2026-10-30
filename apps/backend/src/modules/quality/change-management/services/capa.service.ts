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
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CAPARequest } from '../../../../entities/capa-request.entity';
import { CAPAAction } from '../../../../entities/capa-action.entity';
import { parseDateEnd, parseDateStart } from '../../../../shared/date.util';
import { NumberingService } from '../../../../shared/numbering.service';
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

  private async findRequest(capaNo: string, company?: string, plant?: string) {
    const item = await this.capaRepo.findOne({ where: { capaNo, ...this.tenantWhere(company, plant) } });
    if (!item) throw new NotFoundException('CAPA 요청을 찾을 수 없습니다.');
    this.assertSameTenant('CAPA 요청', item, company, plant);
    return item;
  }

  /** 조치 항목 조회·삭제 조건 */
  private actionKey(capa: CAPARequest, capaNo: string) {
    return { capaId: capaNo };
  }

  /** 공통코드(사용 중)에 있는 값인지 확인한다 */
  private async assertComCode(group: string, code: string, company: string, plant: string, label: string): Promise<void> {
    const rows: Array<{ cnt: number | string }> = await this.capaRepo.manager.query(
      `SELECT COUNT(*) AS "cnt" FROM COM_CODES
        WHERE GROUP_CODE = :1 AND DETAIL_CODE = :2 AND USE_YN = 'Y' AND COMPANY = :3 AND PLANT_CD = :4`,
      [group, code, company, plant],
    );
    if (Number(rows[0]?.cnt ?? 0) === 0) {
      throw new BadRequestException(`${label} 값이 공통코드(${group})에 없습니다: ${code}`);
    }
  }

  /** 조치 항목이 하나라도 DONE 이 아니면 검증·종료할 수 없다(미완료 조치가 남은 채 CAPA 가 닫히던 것) */
  private async assertActionsDone(capa: CAPARequest, what: string): Promise<void> {
    const pending = await this.actionRepo.count({ where: { ...this.actionKey(capa, capa.capaNo), status: Not('DONE') } });
    if (pending > 0) {
      throw new BadRequestException(`완료(DONE)되지 않은 조치 항목이 ${pending}건 있어 ${what}할 수 없습니다.`);
    }
  }

  // =============================================
  // CAPA 번호 자동채번
  // =============================================

  /**
   * CAPA 번호 자동채번: CA-YYYYMMDD-NNN (시정) / PA-YYYYMMDD-NNN (예방)
   * 접두어가 2종이므로 NUM_RULE_MASTERS 채널도 CAPA_CA / CAPA_PA로 분리한다.
   * 각 행을 SELECT FOR UPDATE로 잠가 동시 채번을 직렬화한다.
   */
  private async generateCapaNo(capaType: string): Promise<string> {
    return this.numbering.next(capaType === 'CORRECTIVE' ? 'CAPA_CA' : 'CAPA_PA');
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
      fromDate,
      toDate,
    } = query;

    const qb = this.capaRepo.createQueryBuilder('c');

    if (company) qb.andWhere('c.company = :company', { company });
    if (plant) qb.andWhere('c.plant = :plant', { plant });
    if (status) qb.andWhere('c.status = :status', { status });
    if (capaType) qb.andWhere('c.capaType = :capaType', { capaType });
    if (sourceType) qb.andWhere('c.sourceType = :sourceType', { sourceType });
    if (priority) qb.andWhere('c.priority = :priority', { priority });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(c.capaNo LIKE :sCode OR c.title LIKE :sRaw)',
        { sCode: `%${upper}%`, sRaw: `%${search}%` },
      );
    }
    // 시작일·종료일은 하나만 와도 걸린다(둘 다 있어야 걸리면 하나만 보냈을 때 구간이 통째로 사라졌고, ISO 시각은 날짜 변환이 깨졌다)
    const from = parseDateStart(fromDate);
    const to = parseDateEnd(toDate);
    if (from) qb.andWhere('c.createdAt >= :fromDate', { fromDate: from });
    if (to) qb.andWhere('c.createdAt <= :toDate', { toDate: to });

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
  async findById(capaNo: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
    const actions = await this.actionRepo.find({
      where: { capaId: capaNo },
      order: { seq: 'ASC' },
    });
    return { ...item, actions };
  }

  /**
   * CAPA 등록 (조치 항목이 있으면 같은 트랜잭션으로 함께 저장)
   */
  async create(
    dto: CreateCapaDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const capaNo = await this.generateCapaNo(dto.capaType);
    const { actions, targetDate, ...fields } = dto;
    // 조치 항목 순번이 겹치면 save 가 뒤의 것으로 앞의 것을 조용히 덮어쓴다
    const duplicateSeq = (actions ?? []).map((a) => a.seq).find((seq, i, all) => all.indexOf(seq) !== i);
    if (duplicateSeq !== undefined) {
      throw new ConflictException(`조치 항목 순번이 중복되었습니다: ${duplicateSeq}`);
    }

    const entity = this.capaRepo.create({
      ...fields,
      // 날짜 문자열을 그대로 넣으면 ISO 시각이 DB 날짜 변환에서 500 이 된다
      targetDate: parseDateStart(targetDate) ?? undefined,
      capaNo,
      status: 'OPEN',
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });

    // 요청과 조치 항목은 한 트랜잭션(항목 저장이 실패하면 요청만 남던 것)
    const saved = await this.capaRepo.manager.transaction(async (manager) => {
      const created = await manager.getRepository(CAPARequest).save(entity);
      if (actions && actions.length > 0) {
        const actionRepo = manager.getRepository(CAPAAction);
        const actionEntities = actions.map((a) =>
          actionRepo.create({
            capaId: created.capaNo,
            seq: a.seq,
            actionDesc: a.actionDesc,
            responsibleCode: a.responsibleCode ?? null,
            dueDate: parseDateStart(a.dueDate),
            status: 'PENDING',
          }),
        );
        await actionRepo.save(actionEntities);
      }
      return created;
    });

    this.logger.log(`CAPA 등록: ${capaNo} (type: ${dto.capaType})`);
    return saved;
  }

  /**
   * CAPA 수정 (OPEN 상태에서만)
   */
  async update(capaNo: string, dto: UpdateCapaDto, userId: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
    if (!['OPEN', 'ANALYZING'].includes(item.status)) {
      throw new BadRequestException('OPEN 또는 ANALYZING 상태에서만 수정할 수 있습니다.');
    }
    const { actions, targetDate, ...updateFields } = dto;
    // 번호의 접두(CA/PA)가 유형을 나타내므로 번호가 정해진 뒤에는 유형을 바꿀 수 없다
    if (updateFields.capaType != null && updateFields.capaType !== item.capaType) {
      throw new BadRequestException(`CAPA 유형은 번호(${item.capaNo})가 정해진 뒤에는 바꿀 수 없습니다.`);
    }
    // 비울 수 없는 칸(유형·제목)에 null 이 오면 그대로 둔다(저장 시 NOT NULL 오류 500)
    for (const key of ['capaType', 'title'] as const) {
      if (updateFields[key] == null) delete updateFields[key];
    }
    Object.assign(item, updateFields, {
      updatedBy: userId,
      ...(targetDate !== undefined ? { targetDate: parseDateStart(targetDate)! } : {}),
    });
    return this.capaRepo.save(item);
  }

  /**
   * CAPA 삭제 (OPEN 상태에서만, 다른 문서가 참조하면 거부)
   */
  async delete(capaNo: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
    if (item.status !== 'OPEN') {
      throw new BadRequestException('OPEN 상태에서만 삭제할 수 있습니다.');
    }
    // NCR·심사 발견사항·고객 클레임이 참조하는 CAPA 를 지우면 그 문서들이 없는 번호를 가리킨다
    const refs: Array<{ label: string }> = await this.capaRepo.manager.query(
      `SELECT 'NCR ' || NCR_NO AS "label" FROM NCR_REPORTS WHERE CAPA_NO = :1 AND COMPANY = :2 AND PLANT_CD = :3
       UNION ALL
       SELECT '심사 ' || AUDIT_ID || ' #' || FINDING_NO FROM AUDIT_FINDINGS WHERE CAPA_ID = :4 AND COMPANY = :5 AND PLANT_CD = :6
       UNION ALL
       SELECT '클레임 ' || COMPLAINT_NO FROM CUSTOMER_COMPLAINTS WHERE CAPA_ID = :7 AND COMPANY = :8 AND PLANT_CD = :9`,
      [capaNo, item.company, item.plant, capaNo, item.company, item.plant, capaNo, item.company, item.plant],
    );
    if (refs.length > 0) {
      throw new BadRequestException(`다른 문서가 참조하는 CAPA 는 삭제할 수 없습니다: ${refs.map((r) => r.label).join(', ')}`);
    }
    // 조치 항목 먼저 삭제
    await this.capaRepo.manager.transaction(async (manager) => {
      await manager.getRepository(CAPAAction).delete(this.actionKey(item, capaNo));
      await manager.getRepository(CAPARequest).remove(item);
    });
  }

  // =============================================
  // 상태 전이
  // =============================================

  /**
   * 원인 분석 완료 (OPEN → ANALYZING)
   */
  async analyze(capaNo: string, dto: AnalyzeCapaDto, userId: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
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
  async plan(capaNo: string, dto: PlanCapaDto, userId: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
    if (item.status !== 'ANALYZING') {
      throw new BadRequestException('ANALYZING 상태에서만 조치 계획을 등록할 수 있습니다.');
    }
    item.actionPlan = dto.actionPlan;
    if (dto.targetDate) item.targetDate = parseDateStart(dto.targetDate)!;
    item.status = 'ACTION_PLANNED';
    item.updatedBy = userId;
    return this.capaRepo.save(item);
  }

  /**
   * 조치 시작 (ACTION_PLANNED → IN_PROGRESS)
   */
  async start(capaNo: string, userId: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
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
  async verify(capaNo: string, dto: VerifyCapaDto, userId: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
    if (item.status !== 'IN_PROGRESS') {
      throw new BadRequestException('IN_PROGRESS 상태에서만 검증할 수 있습니다.');
    }
    await this.assertActionsDone(item, '검증');
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
  async close(capaNo: string, userId: string, company?: string, plant?: string) {
    const item = await this.findRequest(capaNo, company, plant);
    if (item.status !== 'VERIFYING') {
      throw new BadRequestException('VERIFYING 상태에서만 종료할 수 있습니다.');
    }
    await this.assertActionsDone(item, '종료');
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
  async addAction(capaNo: string, dto: CAPAActionItemDto, userId: string, company?: string, plant?: string) {
    const capa = await this.findRequest(capaNo, company, plant);
    if (['VERIFYING', 'CLOSED'].includes(capa.status)) {
      throw new BadRequestException('검증 중이거나 종료된 CAPA 에는 조치 항목을 추가할 수 없습니다.');
    }
    // 같은 순번이 있으면 save 가 기존 항목을 조용히 덮어쓴다
    const duplicate = await this.actionRepo.findOne({ where: { ...this.actionKey(capa, capaNo), seq: dto.seq } });
    if (duplicate) {
      throw new ConflictException(`이미 있는 조치 항목 순번입니다: ${dto.seq}`);
    }
    const status = dto.status ?? 'PENDING';
    await this.assertComCode('CAPA_ACTION_STATUS', status, capa.company, capa.plant, '조치 상태');

    const entity = this.actionRepo.create({
      capaId: capaNo,
      seq: dto.seq,
      actionDesc: dto.actionDesc,
      responsibleCode: dto.responsibleCode ?? null,
      dueDate: parseDateStart(dto.dueDate),
      status,
    });
    capa.updatedBy = userId;
    return this.capaRepo.manager.transaction(async (manager) => {
      await manager.getRepository(CAPARequest).save(capa);
      return manager.getRepository(CAPAAction).save(entity);
    });
  }

  /**
   * 조치 항목 수정
   */
  async updateAction(
    capaNo: string,
    actionSeq: number,
    dto: Partial<CAPAActionItemDto>,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const capa = await this.findRequest(capaNo, company, plant);
    if (capa.status === 'CLOSED') {
      throw new BadRequestException('종료된 CAPA 의 조치 항목은 바꿀 수 없습니다.');
    }
    const action = await this.actionRepo.findOne({
      where: { ...this.actionKey(capa, capaNo), seq: actionSeq },
    });
    if (!action) {
      throw new NotFoundException('조치 항목을 찾을 수 없습니다.');
    }

    // 비울 수 없는 칸(내용·상태)에 null 이 오면 그대로 둔다
    if (dto.actionDesc != null) action.actionDesc = dto.actionDesc;
    if (dto.responsibleCode !== undefined) action.responsibleCode = dto.responsibleCode;
    if (dto.dueDate !== undefined) action.dueDate = parseDateStart(dto.dueDate);
    if (dto.status != null) {
      await this.assertComCode('CAPA_ACTION_STATUS', dto.status, capa.company, capa.plant, '조치 상태');
      // DONE 이 아니게 되면 완료 일시를 비운다(남겨 두면 미완료인데 완료 시각이 보였다)
      action.completedAt = dto.status === 'DONE' ? (action.status === 'DONE' && action.completedAt ? action.completedAt : new Date()) : null;
      action.status = dto.status;
    }
    if (dto.result !== undefined) action.result = dto.result;

    // CAPA updatedBy 갱신
    return this.capaRepo.manager.transaction(async (manager) => {
      await manager.getRepository(CAPARequest).update(
        { capaNo, ...this.tenantWhere(company, plant) },
        { updatedBy: userId },
      );
      return manager.getRepository(CAPAAction).save(action);
    });
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
