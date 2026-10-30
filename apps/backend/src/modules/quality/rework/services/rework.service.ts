/**
 * @file src/modules/quality/rework/services/rework.service.ts
 * @description 재작업 관리 서비스 — 2단계 승인, 재작업 실적, 재검사 연동
 *
 * 초보자 가이드:
 * 1. **재작업 지시 CRUD**: 등록, 조회, 수정, 삭제 + 2단계 승인 (품질 → 생산)
 * 2. **상태 흐름**: REGISTERED → QC_PENDING → PROD_PENDING → APPROVED
 *                  → IN_PROGRESS → INSPECT_PENDING → PASS/FAIL/SCRAP
 * 3. **재검사**: 재작업 완료 후 재검사 등록 시 ReworkOrder 상태 자동 업데이트
 * 4. **reworkNo 자동채번**: RW-YYYYMMDD-NNN 형식
 *
 * 주요 메서드:
 * - findAll / findById: 목록/단건 조회
 * - create / update / delete: 기본 CRUD
 * - requestQcApproval: 품질승인 요청 (REGISTERED → QC_PENDING)
 * - qcApprove / prodApprove: 품질/생산 승인 또는 반려
 * - start / complete: 작업 시작/완료
 * - createInspect: 재검사 등록 → ReworkOrder 상태 자동 반영
 * - getStats: 상태별 통계
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw } from 'typeorm';
import { ReworkOrder } from '../../../../entities/rework-order.entity';
import { ReworkInspect } from '../../../../entities/rework-inspect.entity';
import { ReworkProcess } from '../../../../entities/rework-process.entity';
import { DefectLog } from '../../../../entities/defect-log.entity';
import { ItemMaster } from '../../../../entities/item-master.entity';
import { ProductInventoryService } from '../../../inventory/services/product-inventory.service';
import { WarehouseService } from '../../../inventory/services/warehouse.service';
import { NumberingService } from '../../../../shared/numbering.service';
import { TransactionService } from '../../../../shared/transaction.service';
import { DEFECT_LOG_STATUS, deriveDefectLogStatusFromReworkInspect } from '@harness/shared';
import { parseDefectLogId } from '../../defects/defect-log-key';
import {
  CreateReworkOrderDto,
  UpdateReworkOrderDto,
  ReworkQueryDto,
  ApproveReworkDto,
  CompleteReworkDto,
  CreateReworkInspectDto,
} from '../dto/rework.dto';

@Injectable()
export class ReworkService {
  private readonly logger = new Logger(ReworkService.name);

  constructor(
    @InjectRepository(ReworkOrder)
    private readonly reworkRepo: Repository<ReworkOrder>,
    @InjectRepository(ReworkInspect)
    private readonly inspectRepo: Repository<ReworkInspect>,
    @InjectRepository(ReworkProcess)
    private readonly processRepo: Repository<ReworkProcess>,
    @InjectRepository(DefectLog)
    private readonly defectLogRepo: Repository<DefectLog>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepo: Repository<ItemMaster>,
    private readonly productInventoryService: ProductInventoryService,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
    private readonly warehouseService: WarehouseService,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
    return {
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    };
  }

  /** 발생 시각 한 점을 [시각, 시각+1ms) 범위 조건으로 바꾼다.
   *  생산실적에서 만든 불량은 발생 시각이 마이크로초까지 저장돼 밀리초 값과 같지 않으므로 같음 비교로는 찾지 못한다. */
  private occurAtRange(at: Date) {
    const to = new Date(at.getTime() + 1);
    return Raw((col) => `${col} >= :occFrom AND ${col} < :occTo`, { occFrom: at, occTo: to });
  }

  /** 연결 불량 식별자(`발생시각ISO|순번`)를 키로 푼다. 형식이 틀리면 400 */
  private defectKey(defectLogId: string) {
    const key = parseDefectLogId(defectLogId);
    if (!key || key.occurAt === null) {
      throw new BadRequestException(`불량로그 식별자 형식이 올바르지 않습니다(발생시각|순번): ${defectLogId}`);
    }
    return { occurAt: new Date(key.canonicalId.slice(0, key.canonicalId.indexOf('|'))), seq: key.seq, canonicalId: key.canonicalId };
  }

  /** 연결 불량 한 건을 밀리초 범위로 찾는다. 없으면 404 */
  private async findDefect(defectLogId: string, company?: string, plant?: string) {
    const { occurAt, seq, canonicalId } = this.defectKey(defectLogId);
    const defect = await this.defectLogRepo.findOne({
      where: { occurAt: this.occurAtRange(occurAt), seq, ...this.tenantWhere(company, plant) },
    });
    if (!defect) {
      throw new NotFoundException(`불량로그를 찾을 수 없습니다: ${canonicalId}`);
    }
    return defect;
  }

  // =============================================
  // 재작업번호 자동채번
  // =============================================

  /**
   * 재작업번호 자동채번: RW-YYYYMMDD-NNN
   * NUM_RULE_MASTERS(REWORK_NO) 행을 SELECT FOR UPDATE로 잠가 동시 채번을 직렬화한다.
   */
  private async generateReworkNo(): Promise<string> {
    return this.numbering.next('REWORK_NO');
  }

  // =============================================
  // 재작업 지시 CRUD
  // =============================================

  /**
   * 재작업 목록 조회 (페이지네이션 + 필터)
   */
  async findAll(query: ReworkQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 50,
      status,
      defectType,
      lineCode,
      search,
      fromDate,
      toDate,
    } = query;

    const qb = this.reworkRepo.createQueryBuilder('r');

    if (company) qb.andWhere('r.company = :company', { company });
    if (plant) qb.andWhere('r.plant = :plant', { plant });
    if (status) qb.andWhere('r.status = :status', { status });
    if (defectType) qb.andWhere('r.defectType = :defectType', { defectType });
    if (lineCode) qb.andWhere('r.lineCode = :lineCode', { lineCode });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(r.reworkNo LIKE :sCode OR r.itemCode LIKE :sCode OR r.itemName LIKE :sRaw)',
        { sCode: `%${upper}%`, sRaw: `%${search}%` },
      );
    }
    if (fromDate && toDate) {
      qb.andWhere('r.createdAt BETWEEN :fromDate AND :toDate', {
        fromDate: new Date(`${fromDate}T00:00:00`),
        toDate: new Date(`${toDate}T23:59:59`),
      });
    }

    qb.orderBy('r.createdAt', 'DESC');
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data, total, page, limit };
  }

  /**
   * 재작업 단건 조회 (reworkNo 기준)
   */
  async findById(reworkNo: string, company?: string, plant?: string) {
    const item = await this.reworkRepo.findOne({
      where: { reworkNo, ...this.tenantWhere(company, plant) },
    });
    if (!item) {
      throw new NotFoundException('재작업 지시를 찾을 수 없습니다.');
    }
    const processes = await this.processRepo.find({
      where: { reworkOrderId: item.reworkNo, ...this.tenantWhere(company, plant) },
      order: { seq: 'ASC' },
    });
    return { ...item, processes };
  }

  /**
   * 재작업 지시 등록
   */
  async create(
    dto: CreateReworkOrderDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    // 품목 존재 확인
    const item = await this.itemMasterRepo.findOne({
      where: { itemCode: dto.itemCode, ...this.tenantWhere(company, plant) },
      select: ['itemCode'],
    });
    if (!item) {
      throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);
    }

    // 연결 불량: 형식 검증, 존재(WAIT) 확인, 중복 연결 차단, 수량 비교
    let defect: DefectLog | null = null;
    let canonicalId: string | null = null;
    if (dto.defectLogId) {
      const { occurAt, seq, canonicalId: cid } = this.defectKey(dto.defectLogId);
      canonicalId = cid;
      defect = await this.findDefect(dto.defectLogId, company, plant);
      if (defect.status !== DEFECT_LOG_STATUS.WAIT) {
        throw new BadRequestException(
          `대기(WAIT) 상태의 불량만 재작업을 지시할 수 있습니다. 현재 상태: ${defect.status}`,
        );
      }
      const linked = await this.reworkRepo.findOne({
        where: { defectLogId: canonicalId, ...this.tenantWhere(company, plant) },
      });
      if (linked) {
        throw new BadRequestException(`이미 재작업(${linked.reworkNo})이 연결된 불량입니다.`);
      }
      if (dto.reworkQty > defect.qty) {
        throw new BadRequestException(
          `재작업 수량(${dto.reworkQty})이 불량 수량(${defect.qty})보다 많을 수 없습니다.`,
        );
      }
    }

    const reworkNo = await this.generateReworkNo();
    const entity = this.reworkRepo.create({
      reworkNo,
      defectLogId: canonicalId,
      itemCode: dto.itemCode,
      itemName: dto.itemName ?? null,
      prdUid: dto.prdUid ?? null,
      reworkQty: dto.reworkQty,
      defectType: dto.defectType ?? null,
      reworkMethod: dto.reworkMethod,
      workerId: dto.workerId ?? null,
      lineCode: dto.lineCode ?? null,
      equipCode: dto.equipCode ?? null,
      remark: dto.remark ?? null,
      status: 'REGISTERED',
      isolationFlag: 1,
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    await this.reworkRepo.save(entity);
    const saved = await this.reworkRepo.findOne({ where: { reworkNo, company, plant } });

    // 공정 목록 생성
    if (dto.processItems && dto.processItems.length > 0) {
      const processEntities = dto.processItems.map((pi) =>
        this.processRepo.create({
          reworkOrderId: saved.reworkNo,
          processCode: pi.processCode,
          processName: pi.processName,
          seq: pi.seq,
          workerId: pi.workerId ?? null,
          lineCode: pi.lineCode ?? null,
          equipCode: pi.equipCode ?? null,
          planQty: dto.reworkQty,
          status: 'WAITING',
          company,
          plant,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      await this.processRepo.save(processEntities);
    }

    // 불량 이력 상태 연동 (밀리초 범위)
    if (defect) {
      await this.defectLogRepo.update(
        { occurAt: this.occurAtRange(defect.occurAt), seq: defect.seq, ...this.tenantWhere(company, plant) },
        { status: DEFECT_LOG_STATUS.REWORK },
      );
    }

    this.logger.log(
      `재작업 등록: ${reworkNo} (defectLogId: ${dto.defectLogId ?? 'N/A'})`,
    );
    return saved;
  }

  /**
   * 재작업 지시 수정 (등록/반려 상태에서만 가능)
   */
  async update(
    reworkNo: string,
    dto: UpdateReworkOrderDto,
    userId: string,
    company?: string,
    plant?: string,
  ) {
    const item = await this.findById(reworkNo, company, plant);
    if (!['REGISTERED', 'QC_REJECTED', 'PROD_REJECTED'].includes(item.status)) {
      throw new BadRequestException(
        '등록/반려 상태에서만 수정할 수 있습니다.',
      );
    }

    // 연결된 불량은 바꿀 수 없다(같은 값을 다시 보내는 것은 허용)
    if (dto.defectLogId !== undefined && (dto.defectLogId ?? '') !== (item.defectLogId ?? '')) {
      throw new BadRequestException('연결된 불량은 바꿀 수 없습니다. 지시를 지우고 다시 등록해 주세요.');
    }

    // 필수 컬럼(itemCode, reworkQty, reworkMethod)의 null 은 조용히 무시하고 나머지는 키가 있으면 그 값(null 포함)을 적용한다
    const requiredKeys = ['itemCode', 'reworkQty', 'reworkMethod'];
    const patch: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto)) {
      if (key === 'processItems' || key === 'defectLogId') continue;
      if (value === undefined) continue;
      if (value === null && requiredKeys.includes(key)) continue;
      patch[key] = value;
    }

    if (patch.itemCode !== undefined && patch.itemCode !== item.itemCode) {
      const found = await this.itemMasterRepo.findOne({
        where: { itemCode: patch.itemCode as string, ...this.tenantWhere(company, plant) },
        select: ['itemCode'],
      });
      if (!found) {
        throw new NotFoundException(`품목을 찾을 수 없습니다: ${patch.itemCode}`);
      }
    }

    let qtyChanged = false;
    if (patch.reworkQty !== undefined) {
      qtyChanged = patch.reworkQty !== item.reworkQty;
      if (qtyChanged && item.defectLogId) {
        const defect = await this.findDefect(item.defectLogId, company, plant);
        if (Number(patch.reworkQty) > defect.qty) {
          throw new BadRequestException(
            `재작업 수량(${patch.reworkQty})이 불량 수량(${defect.qty})보다 많을 수 없습니다.`,
          );
        }
      }
    }

    if (Object.keys(patch).length > 0) {
      await this.reworkRepo.update(
        { reworkNo, ...this.tenantWhere(company, plant) },
        { ...patch, updatedBy: userId },
      );
    }
    // 공정의 계획 수량은 지시 수량을 따른다(아직 시작하지 않은 공정만)
    if (qtyChanged) {
      await this.processRepo.update(
        { reworkOrderId: item.reworkNo, status: 'WAITING', ...this.tenantWhere(company, plant) },
        { planQty: patch.reworkQty as number, updatedBy: userId },
      );
    }
    return this.findById(reworkNo, company, plant);
  }

  /**
   * 재작업 지시 삭제 (등록 상태에서만 가능)
   */
  async delete(reworkNo: string, company?: string, plant?: string) {
    const item = await this.findById(reworkNo, company, plant);
    if (item.status !== 'REGISTERED') {
      throw new BadRequestException('등록 상태에서만 삭제할 수 있습니다.');
    }
    const progressedProcesses = (item.processes ?? []).filter(
      (process) => process.status && process.status !== 'WAITING',
    );
    if (progressedProcesses.length > 0) {
      throw new BadRequestException(
        '이미 재작업 공정이 진행된 건은 직접 삭제할 수 없습니다. 재작업 공정부터 먼저 정리해 주세요.',
      );
    }
    const linkedInspects = await this.inspectRepo.find({
      where: { reworkOrderId: reworkNo, ...this.tenantWhere(company, plant) },
    });
    if (linkedInspects.length > 0) {
      throw new BadRequestException(
        '이미 재작업 검사 이력이 있는 건은 직접 삭제할 수 없습니다. 검사 이력부터 먼저 정리해 주세요.',
      );
    }
    if (item.defectLogId) {
      const parsed = parseDefectLogId(item.defectLogId);
      if (parsed && parsed.occurAt !== null) {
        const { occurAt, seq } = this.defectKey(item.defectLogId);
        await this.defectLogRepo.update(
          { occurAt: this.occurAtRange(occurAt), seq, ...this.tenantWhere(company, plant), status: DEFECT_LOG_STATUS.REWORK },
          { status: DEFECT_LOG_STATUS.WAIT },
        );
      }
    }
    await this.processRepo.delete({ reworkOrderId: reworkNo, ...this.tenantWhere(company, plant) });
    await this.reworkRepo.delete({ reworkNo, ...this.tenantWhere(company, plant) });
  }

  // =============================================
  // 2단계 승인
  // =============================================

  /**
   * 품질승인 요청 (REGISTERED → QC_PENDING)
   */
  async requestQcApproval(reworkNo: string, userId: string, company?: string, plant?: string) {
    const item = await this.findById(reworkNo, company, plant);
    if (!['REGISTERED', 'QC_REJECTED', 'PROD_REJECTED'].includes(item.status)) {
      throw new BadRequestException(
        '등록 또는 반려 상태에서만 승인 요청할 수 있습니다.',
      );
    }
    await this.reworkRepo.update({ reworkNo, ...this.tenantWhere(company, plant) }, {
      status: 'QC_PENDING',
      updatedBy: userId,
    });
    return this.findById(reworkNo, company, plant);
  }

  /**
   * 품질 승인/반려 (QC_PENDING → PROD_PENDING 또는 QC_REJECTED)
   */
  async qcApprove(reworkNo: string, dto: ApproveReworkDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(reworkNo, company, plant);
    if (item.status !== 'QC_PENDING') {
      throw new BadRequestException('품질승인대기 상태가 아닙니다.');
    }
    const updateData: Partial<ReworkOrder> = { updatedBy: userId, qcApproverCode: userId };
    if (dto.action === 'APPROVE') {
      updateData.status = 'PROD_PENDING';
      updateData.qcApprovedAt = new Date();
    } else {
      updateData.status = 'QC_REJECTED';
      updateData.qcRejectReason = dto.reason ?? null;
    }
    await this.reworkRepo.update({ reworkNo, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(reworkNo, company, plant);
  }

  /**
   * 생산 승인/반려 (PROD_PENDING → APPROVED 또는 PROD_REJECTED)
   */
  async prodApprove(reworkNo: string, dto: ApproveReworkDto, userId: string, company?: string, plant?: string) {
    const item = await this.findById(reworkNo, company, plant);
    if (item.status !== 'PROD_PENDING') {
      throw new BadRequestException('생산승인대기 상태가 아닙니다.');
    }
    const updateData: Partial<ReworkOrder> = { updatedBy: userId, prodApproverCode: userId };
    if (dto.action === 'APPROVE') {
      updateData.status = 'APPROVED';
      updateData.prodApprovedAt = new Date();
    } else {
      updateData.status = 'PROD_REJECTED';
      updateData.prodRejectReason = dto.reason ?? null;
    }
    await this.reworkRepo.update({ reworkNo, ...this.tenantWhere(company, plant) }, updateData);
    return this.findById(reworkNo, company, plant);
  }

  // =============================================
  // 작업 진행
  // =============================================

  /**
   * 작업 시작 (APPROVED / IN_PROGRESS → IN_PROGRESS)
   * 공정이 있는 경우 공정별 메서드(startProcess)로 세부 관리
   */
  async start(reworkNo: string, userId: string, company?: string, plant?: string) {
    const item = await this.findById(reworkNo, company, plant);
    if (!['APPROVED', 'IN_PROGRESS'].includes(item.status)) {
      throw new BadRequestException(
        '승인 완료 또는 진행중 상태에서만 시작할 수 있습니다.',
      );
    }
    if (item.status === 'APPROVED') {
      await this.reworkRepo.update({ reworkNo, ...this.tenantWhere(company, plant) }, {
        status: 'IN_PROGRESS',
        startAt: new Date(),
        updatedBy: userId,
      });
    }
    return this.findById(reworkNo, company, plant);
  }

  /**
   * 작업 완료 (IN_PROGRESS → INSPECT_PENDING)
   * 공정이 있는 경우 마지막 순번 완료 공정의 resultQty (순차 공정은 합산하지 않음)
   */
  async complete(reworkNo: string, dto: CompleteReworkDto, userId: string, company?: string, plant?: string) {
    const order = await this.reworkRepo.findOne({
      where: { reworkNo, ...this.tenantWhere(company, plant) },
    });
    if (!order) throw new NotFoundException('재작업 지시를 찾을 수 없습니다.');
    if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestException('진행중 상태에서만 완료할 수 있습니다.');
    }

    // 공정 실적 합산
    const processes = await this.processRepo.find({
      where: { reworkOrderId: order.reworkNo, ...this.tenantWhere(company, plant) },
    });
    let totalResultQty = dto.resultQty;
    if (processes.length > 0) {
      // 공정이 있으면 모두 완료/건너뛰여야 한다. 안 끝난 공정이 남으면 완료로 넘어가면 안 된다.
      const open = processes.filter((p) => p.status !== 'COMPLETED' && p.status !== 'SKIPPED');
      if (open.length > 0) {
        throw new BadRequestException(
          `완료·건너뛰지 않은 공정이 ${open.length}개 남아 있습니다. 공정을 먼저 처리해 주세요.`,
        );
      }
      // 공정은 순서대로 같은 제품을 가공하므로 합산하지 않는다: 마지막 순번의 완료 공정 수량이 지시의 실적이다
      const completed = processes.filter((p) => p.status === 'COMPLETED').sort((a, b) => b.seq - a.seq);
      totalResultQty = completed[0]?.resultQty ?? 0;
    }
    if (!Number.isInteger(totalResultQty) || totalResultQty < 1) {
      throw new BadRequestException(
        `재작업 실적 수량은 1 이상의 정수여야 합니다. 입력=${totalResultQty ?? '없음'}`,
      );
    }
    if (totalResultQty > order.reworkQty) {
      throw new BadRequestException(
        `재작업 실적 수량(${totalResultQty})이 재작업 수량(${order.reworkQty})보다 많을 수 없습니다.`,
      );
    }

    await this.reworkRepo.update({ reworkNo, ...this.tenantWhere(company, plant) }, {
      status: 'INSPECT_PENDING',
      endAt: new Date(),
      resultQty: totalResultQty,
      remark: dto.remark ?? order.remark,
      updatedBy: userId,
    });
    return this.findById(reworkNo, company, plant);
  }

  // =============================================
  // 통계
  // =============================================

  /**
   * 상태별 통계 (건수 + 수량 합계)
   */
  async getStats(company?: string, plant?: string) {
    const qb = this.reworkRepo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(r.reworkQty), 0)', 'totalQty');

    if (company) qb.andWhere('r.company = :company', { company });
    if (plant) qb.andWhere('r.plant = :plant', { plant });

    qb.groupBy('r.status');
    return qb.getRawMany();
  }

  // =============================================
  // 재검사
  // =============================================

  /**
   * 재검사 목록 조회
   */
  async findInspects(
    reworkOrderId?: string,
    company?: string,
    plant?: string,
  ) {
    const qb = this.inspectRepo
      .createQueryBuilder('ri')
      .leftJoinAndSelect('ri.reworkOrder', 'ro');

    if (reworkOrderId) {
      qb.andWhere('ri.rework_order_id = :reworkOrderId', { reworkOrderId });
    }
    if (company) qb.andWhere('ri.company = :company', { company });
    if (plant) qb.andWhere('ri.plant = :plant', { plant });

    qb.orderBy('ri.created_at', 'DESC');
    return qb.getMany();
  }

  /**
   * 재검사 등록 → ReworkOrder 상태 자동 업데이트
   *
   * 검사 결과에 따라:
   * - PASS: ReworkOrder 상태 → PASS, 격리 해제
   * - FAIL: ReworkOrder 상태 → FAIL, 격리 유지
   * - SCRAP: ReworkOrder 상태 → SCRAP, 격리 유지
   */
  async createInspect(
    dto: CreateReworkInspectDto,
    company: string,
    plant: string,
    userId: string,
  ) {
    const order = await this.findById(dto.reworkNo, company, plant);
    if (order.status !== 'INSPECT_PENDING') {
      throw new BadRequestException('재검사대기 상태가 아닙니다.');
    }
    const resultQty = Number(order.resultQty ?? 0);
    const passQty = Number(dto.passQty);
    const failQty = Number(dto.failQty);
    if (!Number.isInteger(passQty) || !Number.isInteger(failQty) || passQty < 0 || failQty < 0) {
      throw new BadRequestException('합격/불합격 수량은 0 이상의 정수여야 합니다.');
    }
    if (resultQty <= 0 || passQty + failQty !== resultQty) {
      throw new BadRequestException(`검사 수량이 재작업 실적과 일치하지 않습니다. 대상=${resultQty}, 입력=${passQty + failQty}`);
    }
    if (dto.inspectResult === 'PASS' && (passQty !== resultQty || failQty !== 0)) {
      throw new BadRequestException('PASS 판정은 전체 수량이 합격이어야 합니다.');
    }
    if (dto.inspectResult === 'FAIL' && (passQty !== 0 || failQty !== resultQty)) {
      throw new BadRequestException('FAIL 판정은 전체 수량이 불합격이어야 합니다.');
    }
    if (dto.inspectResult === 'SCRAP' && (passQty !== 0 || failQty !== resultQty)) {
      throw new BadRequestException('SCRAP 판정은 전체 수량이 불합격(폐기)이어야 합니다.');
    }

    return this.tx.run(async (qr) => {
    // 같은 지시에 대한 동시 재검사 등록을 막기 위해 지시 행을 잠그고 상태를 다시 확인한다
    const lockedOrder = await qr.manager.findOne(ReworkOrder, {
      where: { reworkNo: dto.reworkNo, company, plant },
      lock: { mode: 'pessimistic_write' },
    });
    if (!lockedOrder || lockedOrder.status !== 'INSPECT_PENDING') {
      throw new BadRequestException('재검사대기 상태가 아닙니다.');
    }

    const seqRows = await qr.query(
      'SELECT SEQ_REWORK_INSPECT.NEXTVAL AS "NEXT_SEQ" FROM DUAL',
    );
    const nextSeq = Number(seqRows[0]?.NEXT_SEQ ?? seqRows[0]?.next_seq);

    const inspect = qr.manager.create(ReworkInspect, {
      reworkOrderId: order.reworkNo,
      seq: nextSeq,
      inspectorCode: dto.inspectorCode,
      inspectMethod: dto.inspectMethod,
      inspectResult: dto.inspectResult,
      passQty: dto.passQty,
      failQty: dto.failQty,
      defectDetail: dto.defectDetail,
      remark: dto.remark,
      inspectAt: new Date(),
      company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await qr.manager.save(ReworkInspect, inspect);

    // ReworkOrder 상태 및 수량 업데이트
      await qr.manager.update(ReworkOrder, { reworkNo: dto.reworkNo, company, plant }, {
      status: dto.inspectResult,
      passQty: dto.passQty,
      failQty: dto.failQty,
      isolationFlag: dto.inspectResult !== 'PASS' ? 1 : 0,
      updatedBy: userId,
    });

    // 불량 이력 상태 연동 (밀리초 범위 업데이트)
    if (order.defectLogId) {
      const parsed = parseDefectLogId(order.defectLogId);
      if (parsed && parsed.occurAt !== null) {
        const { occurAt, seq } = this.defectKey(order.defectLogId);
        const defectStatus = deriveDefectLogStatusFromReworkInspect(dto.inspectResult);
        await qr.manager.update(
          DefectLog,
          { occurAt: this.occurAtRange(occurAt), seq, ...this.tenantWhere(company, plant) },
          { status: defectStatus },
        );
      }
    }

    // 재작업 결과에 따라 불량재고(불용창고)를 정리한다.
    //  - 합격분(passQty): 불용창고 → 공정창고로 이동(다시 정상 재고화)
    //  - 폐기분(failQty): 불용창고 → SCRAP 폐기창고로 이동
    //  - FAIL(재재작업)은 불용창고에 그대로 둔다.
    // 생산실적이 불량을 불용창고(UNUSABLE 유형 기본창고)에 적재해 두므로, 합격해도 양품이 새로 생기는 게 아니라
    // 불량재고가 정상재고로 '이동'한다. 이동 가능한 재고가 부족하면 신규 입고로 보충하지 않고 실패한다(이중계상 방지).
    if (dto.inspectResult !== 'FAIL') {
      const movingQty = (dto.passQty ?? 0) + (dto.failQty ?? 0);
      let unusableCode: string | null = null;
      if (movingQty > 0) {
        const unusable = await this.warehouseService.getDefaultWarehouse('UNUSABLE', company, plant);
        if (!unusable) {
          throw new BadRequestException('불용창고가 설정되어 있지 않습니다.');
        }
        unusableCode = unusable.warehouseCode;
      }

      const part = await qr.manager.findOne(ItemMaster, {
        where: { itemCode: order.itemCode, ...this.tenantWhere(company, plant) },
        select: ['itemCode', 'itemType'],
      });
      const itemType = part?.itemType === 'FINISHED' ? 'FINISHED' : 'SEMI_PRODUCT';

      const wipWarehouse = itemType === 'FINISHED' ? 'FG_WIP' : 'SFG_WIP';
      const finished = itemType === 'FINISHED';
      if ((dto.passQty ?? 0) > 0) {
        // 불용창고의 불량(DEFECT) 재고를 출고하고 공정창고에 양품(GOOD)으로 입고한다.
        // 한 번의 이동(transfer)은 품질상태를 유지해 합격품이 불량 상태로 남으므로 두 단계로 나눈다
        // (수리실 인수/복귀 repair-stock.service 와 같은 방식). 출고는 가용재고가 부족하면
        // 예외로 실패한다 — 신규 입고로 보충하지 않는다(이중계상 방지).
        await this.productInventoryService.issueStockInTx(qr, {
          warehouseId: unusableCode!,
          itemCode: order.itemCode,
          itemType,
          qualityStatus: 'DEFECT',
          qty: dto.passQty,
          transType: finished ? 'FG_OUT' : 'WIP_OUT',
          refType: 'REWORK',
          refId: order.reworkNo,
          remark: `재작업 합격 출고 (${order.reworkNo})`,
          company,
          plant,
        });
        await this.productInventoryService.receiveStockInTx(qr, {
          warehouseId: wipWarehouse,
          itemCode: order.itemCode,
          itemType,
          qualityStatus: 'GOOD',
          qty: dto.passQty,
          transType: finished ? 'FG_IN' : 'WIP_IN',
          refType: 'REWORK',
          refId: order.reworkNo,
          remark: `재작업 합격 입고 (${order.reworkNo})`,
          company,
          plant,
        });
        this.logger.log(`재작업 합격 → ${wipWarehouse}: ${order.itemCode} × ${dto.passQty} (재작업 #${order.reworkNo})`);
      }

      if ((dto.failQty ?? 0) > 0) {
        // 폐기분은 불량 상태 그대로 폐기창고로 옮긴다. 출고 API 가 toWarehouseId 를 받으면
        // 같은 품질상태로 도착창고에 적재하므로 한 호출로 끝난다. 부족하면 예외로 실패한다.
        await this.productInventoryService.issueStockInTx(qr, {
          warehouseId: unusableCode!,
          toWarehouseId: 'SCRAP',
          itemCode: order.itemCode,
          itemType,
          qualityStatus: 'DEFECT',
          qty: dto.failQty,
          transType: 'SCRAP',
          refType: 'REWORK',
          refId: order.reworkNo,
          remark: `재작업 폐기 (${order.reworkNo})`,
          company,
          plant,
        });
        this.logger.log(`재작업 폐기 → SCRAP: ${order.itemCode} × ${dto.failQty} (재작업 #${order.reworkNo})`);
      }
    }

    this.logger.log(
      `재검사 등록: reworkNo=${dto.reworkNo}, result=${dto.inspectResult}`,
    );
      return saved;
    });
  }

  /**
   * 재검사 단건 조회 (복합키: reworkOrderId + seq)
   */
  async findInspectById(reworkOrderId: string, seq: number, company?: string, plant?: string) {
    const item = await this.inspectRepo.findOne({
      where: { reworkOrderId, seq, ...this.tenantWhere(company, plant) },
      relations: ['reworkOrder'],
    });
    if (!item) {
      throw new NotFoundException('재검사 기록을 찾을 수 없습니다.');
    }
    return item;
  }
}
