/**
 * @file src/modules/quality/services/rework.service.ts
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
import { Repository } from 'typeorm';
import { ReworkOrder } from '../../../entities/rework-order.entity';
import { ReworkInspect } from '../../../entities/rework-inspect.entity';
import { ReworkProcess } from '../../../entities/rework-process.entity';
import { DefectLog } from '../../../entities/defect-log.entity';
// 공정/실적 관리는 ReworkProcessService에서 처리
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
  ) {}

  // =============================================
  // 재작업번호 자동채번
  // =============================================

  /**
   * 재작업번호 자동채번: RW-YYYYMMDD-NNN
   */
  private async generateReworkNo(company: string, plant: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RW-${dateStr}-`;

    const last = await this.reworkRepo
      .createQueryBuilder('r')
      .where('r.company = :company', { company })
      .andWhere('r.plant = :plant', { plant })
      .andWhere('r.reworkNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('r.reworkNo', 'DESC')
      .getOne();

    const seq = last ? parseInt(last.reworkNo.slice(-3), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
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
      startDate,
      endDate,
    } = query;

    const qb = this.reworkRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.defectLog', 'dl');

    if (company) qb.andWhere('r.company = :company', { company });
    if (plant) qb.andWhere('r.plant = :plant', { plant });
    if (status) qb.andWhere('r.status = :status', { status });
    if (defectType) qb.andWhere('r.defectType = :defectType', { defectType });
    if (lineCode) qb.andWhere('r.lineCode = :lineCode', { lineCode });
    if (search) {
      qb.andWhere(
        '(UPPER(r.reworkNo) LIKE UPPER(:s) OR UPPER(r.itemCode) LIKE UPPER(:s) OR UPPER(r.itemName) LIKE UPPER(:s))',
        { s: `%${search}%` },
      );
    }
    if (startDate && endDate) {
      qb.andWhere('r.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate: `${endDate}T23:59:59`,
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
   * 재작업 단건 조회
   */
  async findById(id: number) {
    const item = await this.reworkRepo.findOne({
      where: { id },
      relations: ['defectLog'],
    });
    if (!item) {
      throw new NotFoundException('재작업 지시를 찾을 수 없습니다.');
    }
    const processes = await this.processRepo.find({
      where: { reworkOrderId: id },
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
    const reworkNo = await this.generateReworkNo(company, plant);
    const entity = this.reworkRepo.create({
      ...dto,
      reworkNo,
      status: 'REGISTERED',
      isolationFlag: 1,
      company: +company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.reworkRepo.save(entity) as ReworkOrder;

    // 공정 목록 생성
    if (dto.processItems && dto.processItems.length > 0) {
      const processEntities = dto.processItems.map((pi) =>
        this.processRepo.create({
          reworkOrderId: saved.id,
          processCode: pi.processCode,
          processName: pi.processName,
          seq: pi.seq,
          workerCode: pi.workerCode ?? null,
          lineCode: pi.lineCode ?? null,
          equipCode: pi.equipCode ?? null,
          planQty: dto.reworkQty,
          status: 'WAITING',
          company: +company,
          plant,
          createdBy: userId,
          updatedBy: userId,
        }),
      );
      await this.processRepo.save(processEntities);
    }

    // 불량 이력 상태 연동
    if (dto.defectLogId) {
      await this.defectLogRepo.update(dto.defectLogId, { status: 'REWORK' });
    }

    this.logger.log(
      `재작업 등록: ${reworkNo} (defectLogId: ${dto.defectLogId ?? 'N/A'})`,
    );
    return saved;
  }

  /**
   * 재작업 지시 수정 (등록/반려 상태에서만 가능)
   */
  async update(id: number, dto: UpdateReworkOrderDto, userId: string) {
    const item = await this.findById(id);
    if (!['REGISTERED', 'QC_REJECTED', 'PROD_REJECTED'].includes(item.status)) {
      throw new BadRequestException(
        '등록/반려 상태에서만 수정할 수 있습니다.',
      );
    }
    Object.assign(item, dto, { updatedBy: userId });
    return this.reworkRepo.save(item);
  }

  /**
   * 재작업 지시 삭제 (등록 상태에서만 가능)
   */
  async delete(id: number) {
    const item = await this.findById(id);
    if (item.status !== 'REGISTERED') {
      throw new BadRequestException('등록 상태에서만 삭제할 수 있습니다.');
    }
    await this.reworkRepo.remove(item);
  }

  // =============================================
  // 2단계 승인
  // =============================================

  /**
   * 품질승인 요청 (REGISTERED → QC_PENDING)
   */
  async requestQcApproval(id: number, userId: string) {
    const item = await this.findById(id);
    if (!['REGISTERED', 'QC_REJECTED', 'PROD_REJECTED'].includes(item.status)) {
      throw new BadRequestException(
        '등록 또는 반려 상태에서만 승인 요청할 수 있습니다.',
      );
    }
    item.status = 'QC_PENDING';
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  /**
   * 품질 승인/반려 (QC_PENDING → PROD_PENDING 또는 QC_REJECTED)
   */
  async qcApprove(id: number, dto: ApproveReworkDto, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'QC_PENDING') {
      throw new BadRequestException('품질승인대기 상태가 아닙니다.');
    }
    if (dto.action === 'APPROVE') {
      item.status = 'PROD_PENDING';
      item.qcApproverCode = userId;
      item.qcApprovedAt = new Date();
    } else {
      item.status = 'QC_REJECTED';
      item.qcApproverCode = userId;
      item.qcRejectReason = dto.reason ?? null;
    }
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  /**
   * 생산 승인/반려 (PROD_PENDING → APPROVED 또는 PROD_REJECTED)
   */
  async prodApprove(id: number, dto: ApproveReworkDto, userId: string) {
    const item = await this.findById(id);
    if (item.status !== 'PROD_PENDING') {
      throw new BadRequestException('생산승인대기 상태가 아닙니다.');
    }
    if (dto.action === 'APPROVE') {
      item.status = 'APPROVED';
      item.prodApproverCode = userId;
      item.prodApprovedAt = new Date();
    } else {
      item.status = 'PROD_REJECTED';
      item.prodApproverCode = userId;
      item.prodRejectReason = dto.reason ?? null;
    }
    item.updatedBy = userId;
    return this.reworkRepo.save(item);
  }

  // =============================================
  // 작업 진행
  // =============================================

  /**
   * 작업 시작 (APPROVED / IN_PROGRESS → IN_PROGRESS)
   * 공정이 있는 경우 공정별 메서드(startProcess)로 세부 관리
   */
  async start(id: number, userId: string) {
    const item = await this.findById(id);
    if (!['APPROVED', 'IN_PROGRESS'].includes(item.status)) {
      throw new BadRequestException(
        '승인 완료 또는 진행중 상태에서만 시작할 수 있습니다.',
      );
    }
    // If has processes, auto-transition is handled by process-level methods
    if (item.status === 'APPROVED') {
      await this.reworkRepo.update(id, {
        status: 'IN_PROGRESS',
        startAt: new Date(),
        updatedBy: userId,
      });
    }
    return this.findById(id);
  }

  /**
   * 작업 완료 (IN_PROGRESS → INSPECT_PENDING)
   * 공정이 있는 경우 공정별 resultQty 합산
   */
  async complete(id: number, dto: CompleteReworkDto, userId: string) {
    const order = await this.reworkRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('재작업 지시를 찾을 수 없습니다.');
    if (order.status !== 'IN_PROGRESS') {
      throw new BadRequestException('진행중 상태에서만 완료할 수 있습니다.');
    }

    // 공정 실적 합산
    const processes = await this.processRepo.find({ where: { reworkOrderId: id } });
    let totalResultQty = dto.resultQty;
    if (processes.length > 0) {
      totalResultQty = processes
        .filter((p) => p.status === 'COMPLETED')
        .reduce((sum, p) => sum + p.resultQty, 0);
    }

    order.status = 'INSPECT_PENDING';
    order.endAt = new Date();
    order.resultQty = totalResultQty;
    order.remarks = dto.remarks ?? order.remarks;
    order.updatedBy = userId;
    return this.reworkRepo.save(order);
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
    reworkOrderId?: number,
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
    const order = await this.findById(dto.reworkOrderId);
    if (order.status !== 'INSPECT_PENDING') {
      throw new BadRequestException('재검사대기 상태가 아닙니다.');
    }

    const inspect = this.inspectRepo.create({
      ...dto,
      inspectAt: new Date(),
      company: +company,
      plant,
      createdBy: userId,
      updatedBy: userId,
    });
    const saved = await this.inspectRepo.save(inspect);

    // ReworkOrder 상태 및 수량 업데이트
    order.status = dto.inspectResult; // PASS, FAIL, SCRAP
    order.passQty = dto.passQty;
    order.failQty = dto.failQty;
    order.isolationFlag = dto.inspectResult !== 'PASS' ? 1 : 0;
    order.updatedBy = userId;
    await this.reworkRepo.save(order);

    // 불량 이력 상태 연동
    if (order.defectLogId) {
      const defectStatus =
        dto.inspectResult === 'PASS'
          ? 'DONE'
          : dto.inspectResult === 'SCRAP'
            ? 'SCRAP'
            : 'REWORK';
      await this.defectLogRepo.update(order.defectLogId, {
        status: defectStatus,
      });
    }

    this.logger.log(
      `재검사 등록: reworkOrderId=${dto.reworkOrderId}, result=${dto.inspectResult}`,
    );
    return saved;
  }

  /**
   * 재검사 단건 조회
   */
  async findInspectById(id: number) {
    const item = await this.inspectRepo.findOne({
      where: { id },
      relations: ['reworkOrder'],
    });
    if (!item) {
      throw new NotFoundException('재검사 기록을 찾을 수 없습니다.');
    }
    return item;
  }
}
