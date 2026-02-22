/**
 * @file src/modules/production/services/job-order.service.ts
 * @description 작업지시 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **상태 변경**: start, pause, complete, cancel 메서드
 * 3. **ERP 연동**: erpSyncYn 플래그 관리
 * 4. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 *
 * 실제 DB 스키마 (job_orders 테이블):
 * - orderNo가 유니크 키
 * - status: WAITING, RUNNING, PAUSED, DONE, CANCELED
 * - partId로 PartMaster와 연결
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull, Between, ILike, Not } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import {
  CreateJobOrderDto,
  UpdateJobOrderDto,
  JobOrderQueryDto,
  ChangeJobOrderStatusDto,
  UpdateErpSyncDto,
  JobOrderStatus,
} from '../dto/job-order.dto';

@Injectable()
export class JobOrderService {
  private readonly logger = new Logger(JobOrderService.name);

  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(PartMaster)
    private readonly partMasterRepository: Repository<PartMaster>,
    @InjectRepository(ProdResult)
    private readonly prodResultRepository: Repository<ProdResult>,
    @InjectRepository(BomMaster)
    private readonly bomMasterRepository: Repository<BomMaster>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 작업지시 목록 조회
   */
  async findAll(query: JobOrderQueryDto, company?: string, plant?: string) {
    const {
      page = 1,
      limit = 5000,
      search,
      orderNo,
      partId,
      lineCode,
      status,
      planDateFrom,
      planDateTo,
      erpSyncYn,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.jobOrderRepository
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .where('jo.deletedAt IS NULL');

    if (company) qb.andWhere('jo.company = :company', { company });
    if (plant) qb.andWhere('jo.plant = :plant', { plant });
    if (orderNo) qb.andWhere('LOWER(jo.orderNo) LIKE :orderNo', { orderNo: `%${orderNo.toLowerCase()}%` });
    if (partId) qb.andWhere('jo.partId = :partId', { partId });
    if (lineCode) qb.andWhere('jo.lineCode = :lineCode', { lineCode });
    if (status) qb.andWhere('jo.status = :status', { status });
    if (erpSyncYn) qb.andWhere('jo.erpSyncYn = :erpSyncYn', { erpSyncYn });
    if (planDateFrom) qb.andWhere('jo.planDate >= :planDateFrom', { planDateFrom: new Date(planDateFrom) });
    if (planDateTo) qb.andWhere('jo.planDate <= :planDateTo', { planDateTo: new Date(planDateTo) });
    if (search) {
      qb.andWhere(
        '(LOWER(jo.orderNo) LIKE :search OR LOWER(part.partCode) LIKE :search OR LOWER(part.partName) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    qb.orderBy('jo.priority', 'ASC')
      .addOrderBy('jo.planDate', 'ASC')
      .addOrderBy('jo.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();

    return { data, total, page, limit };
  }

  /**
   * 작업지시 단건 조회 (ID)
   */
  async findById(id: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['part', 'prodResults'],
      order: {
        createdAt: 'DESC',
      },
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${id}`);
    }

    // Limit prodResults to 10
    if (jobOrder.prodResults) {
      jobOrder.prodResults = jobOrder.prodResults.slice(0, 10);
    }

    return jobOrder;
  }

  /**
   * 작업지시 단건 조회 (작업지시번호)
   */
  async findByOrderNo(orderNo: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, deletedAt: IsNull() },
      relations: ['part'],
    });

    if (!jobOrder) {
      throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    }

    return jobOrder;
  }

  /**
   * 작업지시 생성
   */
  async create(dto: CreateJobOrderDto) {
    // 중복 체크
    const existing = await this.jobOrderRepository.findOne({
      where: { orderNo: dto.orderNo, deletedAt: IsNull() },
    });

    if (existing) {
      throw new ConflictException(`이미 존재하는 작업지시번호입니다: ${dto.orderNo}`);
    }

    // 품목 존재 확인
    const part = await this.partMasterRepository.findOne({
      where: { id: dto.partId, deletedAt: IsNull() },
    });

    if (!part) {
      throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.partId}`);
    }

    const jobOrder = this.jobOrderRepository.create({
      orderNo: dto.orderNo,
      partId: dto.partId,
      parentId: dto.parentId || null,
      lineCode: dto.lineCode,
      planQty: dto.planQty,
      planDate: dto.planDate ? new Date(dto.planDate) : null,
      priority: dto.priority ?? 5,
      remark: dto.remark,
      status: 'WAITING',
      erpSyncYn: 'N',
    });

    const saved = await this.jobOrderRepository.save(jobOrder);

    // BOM 기반 반제품 작업지시 자동생성
    if (dto.autoCreateChildren) {
      await this.createChildOrders(saved, dto);
    }

    return this.jobOrderRepository.findOne({
      where: { id: saved.id },
      relations: ['part', 'children', 'children.part'],
    });
  }

  /**
   * BOM 기반 반제품 작업지시 자동생성
   */
  private async createChildOrders(parent: JobOrder, dto: CreateJobOrderDto) {
    const bomItems = await this.bomMasterRepository.find({
      where: { parentPartId: parent.partId, useYn: 'Y' },
      order: { seq: 'ASC' },
    });

    if (bomItems.length === 0) return;

    // WIP 타입인 BOM 아이템만 작업지시 생성 (RAW는 불출대상)
    const wipParts = await this.partMasterRepository
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids: bomItems.map(b => b.childPartId) })
      .andWhere('p.partType = :type', { type: 'WIP' })
      .andWhere('p.deletedAt IS NULL')
      .getMany();

    const wipPartIds = new Set(wipParts.map(p => p.id));

    for (let i = 0; i < bomItems.length; i++) {
      const bom = bomItems[i];
      if (!wipPartIds.has(bom.childPartId)) continue;

      const childOrderNo = `${parent.orderNo}-${String(i + 1).padStart(2, '0')}`;
      const childQty = Math.ceil(parent.planQty * Number(bom.qtyPer));

      const childOrder = this.jobOrderRepository.create({
        orderNo: childOrderNo,
        partId: bom.childPartId,
        parentId: parent.id,
        lineCode: dto.lineCode,
        planQty: childQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        remark: `[자동생성] ${parent.orderNo}의 반제품`,
        status: 'WAITING',
        erpSyncYn: 'N',
      });

      await this.jobOrderRepository.save(childOrder);
    }
  }

  /**
   * 작업지시 트리 조회 (완제품 기준 계층구조)
   */
  async findTree(parentId?: string) {
    const where: any = { deletedAt: IsNull() };
    if (parentId) {
      where.id = parentId;
    } else {
      where.parentId = IsNull();
    }

    const roots = await this.jobOrderRepository.find({
      where,
      relations: ['part', 'children', 'children.part'],
      order: { planDate: 'DESC', createdAt: 'DESC' },
      take: 100,
    });

    return roots;
  }

  /**
   * 작업지시 수정
   */
  async update(id: string, dto: UpdateJobOrderDto) {
    const jobOrder = await this.findById(id);

    // DONE 또는 CANCELED 상태에서는 수정 불가
    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시는 수정할 수 없습니다.`);
    }

    const updateData: any = {};
    if (dto.lineCode !== undefined) updateData.lineCode = dto.lineCode;
    if (dto.planQty !== undefined) updateData.planQty = dto.planQty;
    if (dto.planDate !== undefined) updateData.planDate = dto.planDate ? new Date(dto.planDate) : null;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
    if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
    if (dto.status !== undefined) updateData.status = dto.status;

    await this.jobOrderRepository.update(id, updateData);

    return this.jobOrderRepository.findOne({
      where: { id },
      relations: ['part'],
      select: {
        id: true,
        orderNo: true,
        partId: true,
        lineCode: true,
        planQty: true,
        planDate: true,
        priority: true,
        status: true,
        erpSyncYn: true,
        goodQty: true,
        defectQty: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 작업지시 삭제 (소프트 삭제)
   */
  async delete(id: string) {
    const jobOrder = await this.findById(id);

    // RUNNING 상태에서는 삭제 불가
    if (jobOrder.status === 'RUNNING') {
      throw new BadRequestException(`진행 중인 작업지시는 삭제할 수 없습니다.`);
    }

    await this.jobOrderRepository.update(id, { deletedAt: new Date() });

    return this.jobOrderRepository.findOne({
      where: { id },
    });
  }

  // ===== 상태 변경 메서드 =====

  /**
   * 작업 시작 (WAITING/PAUSED -> RUNNING)
   */
  async start(id: string) {
    const jobOrder = await this.findById(id);

    if (
      jobOrder.status !== 'WAITING' &&
      jobOrder.status !== 'PAUSED'
    ) {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 시작할 수 없습니다. WAITING 또는 PAUSED 상태여야 합니다.`,
      );
    }

    const updateData: any = {
      status: 'RUNNING',
    };

    // 최초 시작인 경우 시작 시간 설정
    if (!jobOrder.startAt) {
      updateData.startAt = new Date();
    }

    await this.jobOrderRepository.update(id, updateData);

    return this.jobOrderRepository.findOne({
      where: { id },
      relations: ['part'],
      select: {
        id: true,
        orderNo: true,
        partId: true,
        lineCode: true,
        planQty: true,
        planDate: true,
        priority: true,
        status: true,
        erpSyncYn: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 작업 일시정지 (RUNNING -> PAUSED)
   */
  async pause(id: string) {
    const jobOrder = await this.findById(id);

    if (jobOrder.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 일시정지할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    await this.jobOrderRepository.update(id, { status: 'PAUSED' });

    return this.jobOrderRepository.findOne({
      where: { id },
      relations: ['part'],
      select: {
        id: true,
        orderNo: true,
        partId: true,
        lineCode: true,
        planQty: true,
        planDate: true,
        priority: true,
        status: true,
        erpSyncYn: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 작업 완료 (RUNNING/PAUSED -> DONE)
   */
  async complete(id: string) {
    const jobOrder = await this.findById(id);

    if (
      jobOrder.status !== 'RUNNING' &&
      jobOrder.status !== 'PAUSED'
    ) {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 완료할 수 없습니다. RUNNING 또는 PAUSED 상태여야 합니다.`,
      );
    }

    // 생산실적 집계
    const summary = await this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .where('pr.jobOrderId = :jobOrderId', { jobOrderId: id })
      .andWhere('pr.deletedAt IS NULL')
      .getRawOne();

    await this.jobOrderRepository.update(id, {
      status: 'DONE',
      endAt: new Date(),
      goodQty: summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0,
      defectQty: summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0,
    });

    return this.jobOrderRepository.findOne({
      where: { id },
      relations: ['part'],
      select: {
        id: true,
        orderNo: true,
        partId: true,
        lineCode: true,
        planQty: true,
        planDate: true,
        priority: true,
        status: true,
        erpSyncYn: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 작업 취소 (WAITING/PAUSED -> CANCELED)
   */
  async cancel(id: string, remark?: string) {
    const jobOrder = await this.findById(id);

    if (
      jobOrder.status !== 'WAITING' &&
      jobOrder.status !== 'PAUSED'
    ) {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 취소할 수 없습니다. WAITING 또는 PAUSED 상태여야 합니다.`,
      );
    }

    const updateData: any = {
      status: 'CANCELED',
      endAt: new Date(),
    };
    if (remark) updateData.remark = remark;

    await this.jobOrderRepository.update(id, updateData);

    return this.jobOrderRepository.findOne({
      where: { id },
      relations: ['part'],
      select: {
        id: true,
        orderNo: true,
        partId: true,
        lineCode: true,
        planQty: true,
        planDate: true,
        priority: true,
        status: true,
        erpSyncYn: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * 상태 직접 변경 (관리자용)
   */
  async changeStatus(id: string, dto: ChangeJobOrderStatusDto) {
    await this.findById(id); // 존재 확인

    const updateData: any = { status: dto.status };
    if (dto.remark) updateData.remark = dto.remark;

    await this.jobOrderRepository.update(id, updateData);

    return this.jobOrderRepository.findOne({
      where: { id },
      relations: ['part'],
      select: {
        id: true,
        orderNo: true,
        partId: true,
        lineCode: true,
        planQty: true,
        planDate: true,
        priority: true,
        status: true,
        erpSyncYn: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // ===== ERP 연동 =====

  /**
   * ERP 동기화 플래그 업데이트
   */
  async updateErpSyncYn(id: string, dto: UpdateErpSyncDto) {
    await this.findById(id); // 존재 확인

    await this.jobOrderRepository.update(id, { erpSyncYn: dto.erpSyncYn });

    return this.jobOrderRepository.findOne({
      where: { id },
    });
  }

  /**
   * ERP 미동기화 작업지시 목록 조회
   */
  async findUnsyncedForErp() {
    return this.jobOrderRepository.find({
      where: {
        erpSyncYn: 'N',
        status: 'DONE',
        deletedAt: IsNull(),
      },
      relations: ['part'],
      select: {
        id: true,
        orderNo: true,
        partId: true,
        lineCode: true,
        planQty: true,
        planDate: true,
        priority: true,
        status: true,
        erpSyncYn: true,
        goodQty: true,
        defectQty: true,
        startAt: true,
        endAt: true,
        remark: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { endAt: 'ASC' },
    });
  }

  /**
   * ERP 동기화 완료 처리 (일괄)
   */
  async markAsSynced(ids: string[]) {
    await this.jobOrderRepository.update(ids, { erpSyncYn: 'Y' });

    return { count: ids.length };
  }

  // ===== 통계/집계 =====

  /**
   * 작업지시 실적 집계
   */
  async getJobOrderSummary(id: string) {
    const jobOrder = await this.findById(id);

    const summary = await this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.jobOrderId = :jobOrderId', { jobOrderId: id })
      .andWhere('pr.deletedAt IS NULL')
      .getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
      jobOrderId: id,
      orderNo: jobOrder.orderNo,
      planQty: jobOrder.planQty,
      totalGoodQty,
      totalDefectQty,
      totalQty,
      achievementRate: jobOrder.planQty > 0 ? (totalGoodQty / jobOrder.planQty) * 100 : 0,
      defectRate: totalQty > 0 ? (totalDefectQty / totalQty) * 100 : 0,
      avgCycleTime: summary?.avgCycleTime ? Number(summary.avgCycleTime) : null,
      resultCount: summary?.resultCount ? parseInt(summary.resultCount) : 0,
    };
  }
}
