/**
 * @file src/modules/production/services/job-order.service.ts
 * @description 작업지시 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD 메서드**: 생성, 조회, 수정, 삭제 로직 구현
 * 2. **상태 변경**: start, pause, complete, cancel 메서드
 * 3. **ERP 연동**: erpSyncYn 플래그 관리
 * 4. **TypeORM 사용**: Repository 패턴을 통해 DB 접근
 */

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner, FindOptionsSelect, IsNull, In } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { FgLabel } from '../../../entities/fg-label.entity';
import {
  CreateJobOrderDto,
  UpdateJobOrderDto,
  JobOrderQueryDto,
  ChangeJobOrderStatusDto,
  UpdateErpSyncDto,
} from '../dto/job-order.dto';

/** 작업지시 조회 시 공통으로 사용하는 select 필드 */
const JOB_ORDER_SELECT: FindOptionsSelect<JobOrder> = {
  orderNo: true, planNo: true, itemCode: true, lineCode: true, routingCode: true,
  planQty: true, planDate: true, priority: true, status: true,
  erpSyncYn: true, goodQty: true, defectQty: true,
  startAt: true, endAt: true, custPoNo: true, remark: true,
  createdAt: true, updatedAt: true,
};

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
    @InjectRepository(RoutingGroup)
    private readonly routingGroupRepository: Repository<RoutingGroup>,
    @InjectRepository(RoutingProcess)
    private readonly routingProcessRepository: Repository<RoutingProcess>,
    @InjectRepository(FgLabel)
    private readonly fgLabelRepo: Repository<FgLabel>,
    @InjectRepository(ProdPlan)
    private readonly prodPlanRepo: Repository<ProdPlan>,
    private readonly seqGenerator: SeqGeneratorService,
    private readonly sysConfigService: SysConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /** 작업지시 단건 조회 + select 필드 적용 (내부 헬퍼) */
  private findOneWithSelect(orderNo: string) {
    return this.jobOrderRepository.findOne({
      where: { orderNo }, relations: ['part'], select: JOB_ORDER_SELECT,
    });
  }

  /** 작업지시 목록 조회 */
  async findAll(query: JobOrderQueryDto, company?: string, plant?: string) {
    const {
      page = 1, limit = 50, search, orderNo, itemCode,
      lineCode, status, planDateFrom, planDateTo, erpSyncYn,
    } = query;
    const skip = (page - 1) * limit;

    const qb = this.jobOrderRepository
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .leftJoinAndSelect('jo.routing', 'routing')

    if (company) qb.andWhere('jo.company = :company', { company });
    if (plant) qb.andWhere('jo.plant = :plant', { plant });
    if (orderNo) qb.andWhere('jo.orderNo LIKE :orderNo', { orderNo: `%${orderNo.toUpperCase()}%` });
    if (itemCode) qb.andWhere('jo.itemCode = :itemCode', { itemCode });
    if (lineCode) qb.andWhere('jo.lineCode = :lineCode', { lineCode });
    if (status) qb.andWhere('jo.status = :status', { status });
    if (erpSyncYn) qb.andWhere('jo.erpSyncYn = :erpSyncYn', { erpSyncYn });
    if (planDateFrom) qb.andWhere('jo.planDate >= :planDateFrom', { planDateFrom: new Date(planDateFrom) });
    if (planDateTo) qb.andWhere('jo.planDate <= :planDateTo', { planDateTo: new Date(planDateTo) });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(jo.orderNo LIKE :search OR part.itemCode LIKE :search OR part.itemName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    qb.orderBy('jo.priority', 'ASC')
      .addOrderBy('jo.planDate', 'ASC')
      .addOrderBy('jo.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();
    return { data, total, page, limit };
  }

  /** 작업지시 단건 조회 (orderNo) - 내부용 (prodResults 미포함) */
  async findById(orderNo: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo },
      relations: ['part', 'routing'],
    });
    if (!jobOrder) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    return jobOrder;
  }

  /** 작업지시 상세 조회 (orderNo) - API용 (prodResults 최근 10건 포함, DB 레벨 제한) */
  async findByIdWithResults(orderNo: string) {
    const jobOrder = await this.findById(orderNo);
    const prodResults = await this.prodResultRepository
      .createQueryBuilder('pr')
      .where('pr.orderNo = :orderNo', { orderNo })
      .orderBy('pr.createdAt', 'DESC')
      .take(10)
      .getMany();
    // 라우팅 공정순서 조회
    const routingProcesses = jobOrder.routingCode
      ? await this.routingProcessRepository.find({
          where: { routingCode: jobOrder.routingCode, useYn: 'Y' },
          order: { seq: 'ASC' },
        })
      : [];
    return { ...jobOrder, prodResults, routingProcesses };
  }

  /** 작업지시 단건 조회 (작업지시번호) */
  async findByOrderNo(orderNo: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo },
      relations: ['part', 'routing'],
    });
    if (!jobOrder) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    return jobOrder;
  }

  /** 작업지시 생성 (트랜잭션 처리, company/plant 포함) */
  async create(dto: CreateJobOrderDto, company?: string, plant?: string) {
    // orderNo가 없으면 자동 채번
    if (!dto.orderNo) {
      dto.orderNo = await this.seqGenerator.nextJobOrderNo();
    }

    const existing = await this.jobOrderRepository.findOne({
      where: { orderNo: dto.orderNo },
    });
    if (existing) throw new ConflictException(`이미 존재하는 작업지시번호입니다: ${dto.orderNo}`);

    const part = await this.partMasterRepository.findOne({
      where: { itemCode: dto.itemCode },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);

    // 품목 기반 라우팅 자동 조회
    const routingGroup = await this.routingGroupRepository.findOne({
      where: { itemCode: dto.itemCode, useYn: 'Y' },
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo: dto.orderNo,
        itemCode: dto.itemCode,
        parentOrderNo: dto.parentId || null,
        lineCode: dto.lineCode,
        routingCode: routingGroup?.routingCode || null,
        planQty: dto.planQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        custPoNo: dto.custPoNo || null,
        remark: dto.remark,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
      const saved = await queryRunner.manager.save(jobOrder);

      if (dto.autoCreateChildren) {
        await this.createChildOrders(queryRunner, saved, dto);
      }

      await queryRunner.commitTransaction();
      return this.jobOrderRepository.findOne({
        where: { orderNo: saved.orderNo },
        relations: ['part', 'routing', 'children', 'children.part', 'children.routing'],
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** BOM 기반 반제품 작업지시 자동생성 (트랜잭션 내에서 일괄 저장) */
  private async createChildOrders(queryRunner: QueryRunner, parent: JobOrder, dto: CreateJobOrderDto) {
    const bomItems = await this.bomMasterRepository.find({
      where: { parentItemCode: parent.itemCode, useYn: 'Y' },
      order: { seq: 'ASC' },
    });
    if (bomItems.length === 0) return;

    const wipParts = await this.partMasterRepository
      .createQueryBuilder('p')
      .where('p.itemCode IN (:...ids)', { ids: bomItems.map(b => b.childItemCode) })
      .andWhere('p.itemType = :type', { type: 'WIP' })
      .getMany();

    const wipPartIds = new Set(wipParts.map(p => p.itemCode));
    const childOrders: JobOrder[] = [];

    // 자식 품목들의 라우팅 일괄 조회 (N+1 제거)
    const wipChildCodes = bomItems
      .filter((b) => wipPartIds.has(b.childItemCode))
      .map((b) => b.childItemCode);
    const childRoutings = wipChildCodes.length > 0
      ? await this.routingGroupRepository.find({
          where: { itemCode: In(wipChildCodes), useYn: 'Y' },
        })
      : [];
    const routingMap = new Map(childRoutings.map((r) => [r.itemCode, r]));

    for (let i = 0; i < bomItems.length; i++) {
      const bom = bomItems[i];
      if (!wipPartIds.has(bom.childItemCode)) continue;

      const childRouting = routingMap.get(bom.childItemCode) ?? null;

      childOrders.push(queryRunner.manager.create(JobOrder, {
        orderNo: `${parent.orderNo}-${String(i + 1).padStart(2, '0')}`,
        itemCode: bom.childItemCode,
        parentOrderNo: parent.orderNo,
        lineCode: dto.lineCode,
        routingCode: childRouting?.routingCode || null,
        planQty: Math.ceil(parent.planQty * Number(bom.qtyPer)),
        planDate: dto.planDate ? new Date(dto.planDate) : null,
        priority: dto.priority ?? 5,
        remark: `[자동생성] ${parent.orderNo}의 반제품`,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: parent.company,
        plant: parent.plant,
      }));
    }

    if (childOrders.length > 0) {
      await queryRunner.manager.save(childOrders);
    }
  }

  /** 작업지시 트리 조회 (완제품 기준 계층구조) */
  async findTree(parentOrderNo?: string) {
    return this.jobOrderRepository.find({
      where: parentOrderNo
        ? { orderNo: parentOrderNo }
        : { parentOrderNo: IsNull() },
      relations: ['part', 'routing', 'children', 'children.part', 'children.routing'],
      order: { planDate: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  /** 작업지시 수정 */
  async update(id: string, dto: UpdateJobOrderDto) {
    const jobOrder = await this.findById(id);
    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시는 수정할 수 없습니다.`);
    }

    const updateData: Partial<JobOrder> = {};
    // itemCode 변경 시 라우팅 재조회
    if (dto.itemCode !== undefined && dto.itemCode !== jobOrder.itemCode) {
      updateData.itemCode = dto.itemCode;
      const routingGroup = await this.routingGroupRepository.findOne({
        where: { itemCode: dto.itemCode, useYn: 'Y' },
      });
      updateData.routingCode = routingGroup?.routingCode || null;
    }
    if (dto.lineCode !== undefined) updateData.lineCode = dto.lineCode;
    if (dto.planQty !== undefined) updateData.planQty = dto.planQty;
    if (dto.planDate !== undefined) updateData.planDate = dto.planDate ? new Date(dto.planDate) : null;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.custPoNo !== undefined) updateData.custPoNo = dto.custPoNo;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
    if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.parentId !== undefined) updateData.parentOrderNo = dto.parentId || null;

    await this.jobOrderRepository.update({ orderNo: id }, updateData);
    return this.findOneWithSelect(id);
  }

  /** 작업지시 삭제 (소프트 삭제) */
  async delete(id: string) {
    const jobOrder = await this.findById(id);
    if (jobOrder.status === 'RUNNING') {
      throw new BadRequestException(`진행 중인 작업지시는 삭제할 수 없습니다.`);
    }
    await this.jobOrderRepository.delete({ orderNo: id });
    return { id };
  }

  /** 작업 시작 (WAITING -> RUNNING) */
  async start(id: string) {
    const jobOrder = await this.findById(id);
    if (jobOrder.status !== 'WAITING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 시작할 수 없습니다. WAITING 상태여야 합니다.`,
      );
    }
    const updateData: Partial<JobOrder> = { status: 'RUNNING' };
    if (!jobOrder.startAt) updateData.startAt = new Date();

    await this.jobOrderRepository.update({ orderNo: id }, updateData);

    // FG 바코드 사전 일괄 발행 (PRE_ISSUE 모드)
    const fgTiming = await this.sysConfigService.getValue('FG_BARCODE_ISSUE_TIMING');
    if (fgTiming === 'PRE_ISSUE') {
      const fgJobOrder = await this.findById(id);
      for (let i = 0; i < fgJobOrder.planQty; i++) {
        const fgBarcode = await this.seqGenerator.nextFgBarcode();
        await this.fgLabelRepo.save({
          fgBarcode,
          itemCode: fgJobOrder.itemCode,
          orderNo: fgJobOrder.orderNo,
          status: 'PENDING',
          inspectPassYn: null,
          company: fgJobOrder.company,
          plant: fgJobOrder.plant,
        });
      }
      this.logger.log(`PRE_ISSUE: ${fgJobOrder.orderNo} — ${fgJobOrder.planQty}건 바코드 발행`);
    }

    return this.findOneWithSelect(id);
  }

  /** 홀딩 (WAITING/RUNNING -> HOLD) - 실적등록/출하 전부 차단 */
  async hold(id: string) {
    const jobOrder = await this.findById(id);
    if (jobOrder.status !== 'WAITING' && jobOrder.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 홀딩할 수 없습니다. WAITING 또는 RUNNING 상태여야 합니다.`,
      );
    }
    // 이전 상태 저장 (홀딩해제 시 복귀용)
    await this.jobOrderRepository.update({ orderNo: id }, {
      status: 'HOLD',
      remark: `[HOLD] 이전상태:${jobOrder.status}${jobOrder.remark ? ' | ' + jobOrder.remark : ''}`,
    });
    return this.findOneWithSelect(id);
  }

  /** 홀딩 해제 (HOLD -> 이전 상태 복귀) */
  async holdRelease(id: string) {
    const jobOrder = await this.findById(id);
    if (jobOrder.status !== 'HOLD') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 홀딩해제할 수 없습니다. HOLD 상태여야 합니다.`,
      );
    }
    // remark에서 이전 상태 추출
    const prevMatch = jobOrder.remark?.match(/\[HOLD\] 이전상태:(\w+)/);
    if (!prevMatch?.[1]) {
      throw new BadRequestException('홀딩 이전 상태 정보를 찾을 수 없습니다. remark 데이터가 손상되었습니다.');
    }
    const prevStatus = prevMatch[1];
    // remark에서 HOLD 접두사 제거
    const originalRemark = jobOrder.remark?.replace(/\[HOLD\] 이전상태:\w+( \| )?/, '') || null;

    await this.jobOrderRepository.update({ orderNo: id }, {
      status: prevStatus,
      remark: originalRemark || null,
    });
    return this.findOneWithSelect(id);
  }

  /**
   * 작업 완료 (RUNNING -> DONE)
   * 잔량이 있어도 종료 허용, 트랜잭션으로 집계+상태변경 원자성 보장
   */
  async complete(id: string) {
    const jobOrder = await this.findById(id);
    if (jobOrder.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 완료할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const summary = await queryRunner.manager
        .createQueryBuilder(ProdResult, 'pr')
        .select('SUM(pr.goodQty)', 'totalGoodQty')
        .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
        .where('pr.orderNo = :orderNo', { orderNo: id })
        .getRawOne();

      await queryRunner.manager.update(JobOrder, { orderNo: id }, {
        status: 'DONE',
        endAt: new Date(),
        goodQty: summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0,
        defectQty: summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0,
      });
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.findOneWithSelect(id);
  }

  /** 작업 취소 (WAITING/HOLD -> CANCELED) - 실적 있으면 취소 불가 */
  async cancel(id: string, remark?: string) {
    const jobOrder = await this.findById(id);
    if (jobOrder.status !== 'WAITING' && jobOrder.status !== 'HOLD') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 취소할 수 없습니다. WAITING 또는 HOLD 상태여야 합니다.`,
      );
    }

    // 실적 존재 여부 체크
    const resultCount = await this.prodResultRepository.count({
      where: { orderNo: id },
    });
    if (resultCount > 0) {
      throw new BadRequestException(
        `실적이 ${resultCount}건 등록되어 있어 취소할 수 없습니다. 실적을 먼저 삭제해주세요.`,
      );
    }

    const updateData: Partial<JobOrder> = { status: 'CANCELED', endAt: new Date() };
    if (remark) updateData.remark = remark;
    await this.jobOrderRepository.update({ orderNo: id }, updateData);

    // 생산계획 연결된 경우: orderQty 차감
    if (jobOrder.planNo) {
      await this.prodPlanRepo
        .createQueryBuilder()
        .update(ProdPlan)
        .set({ orderQty: () => `GREATEST(ORDER_QTY - ${jobOrder.planQty}, 0)` })
        .where('planNo = :planNo', { planNo: jobOrder.planNo })
        .execute();
    }

    return this.findOneWithSelect(id);
  }

  /** 상태 직접 변경 (관리자용) */
  async changeStatus(id: string, dto: ChangeJobOrderStatusDto) {
    await this.findById(id);
    const updateData: Partial<JobOrder> = { status: dto.status };
    if (dto.remark) updateData.remark = dto.remark;
    await this.jobOrderRepository.update({ orderNo: id }, updateData);
    return this.findOneWithSelect(id);
  }

  /** ERP 동기화 플래그 업데이트 */
  async updateErpSyncYn(id: string, dto: UpdateErpSyncDto) {
    await this.findById(id);
    await this.jobOrderRepository.update({ orderNo: id }, { erpSyncYn: dto.erpSyncYn });
    return this.jobOrderRepository.findOne({ where: { orderNo: id } });
  }

  /** ERP 미동기화 작업지시 목록 조회 */
  async findUnsyncedForErp() {
    return this.jobOrderRepository.find({
      where: { erpSyncYn: 'N', status: 'DONE' },
      relations: ['part'],
      select: JOB_ORDER_SELECT,
      order: { endAt: 'ASC' },
    });
  }

  /** ERP 동기화 완료 처리 (일괄) */
  async markAsSynced(orderNos: string[]) {
    await this.jobOrderRepository
      .createQueryBuilder()
      .update()
      .set({ erpSyncYn: 'Y' })
      .where('orderNo IN (:...orderNos)', { orderNos })
      .execute();
    return { count: orderNos.length };
  }

  /** 작업지시 실적 집계 */
  async getJobOrderSummary(id: string) {
    const jobOrder = await this.findById(id);
    const summary = await this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.orderNo = :orderNo', { orderNo: jobOrder.orderNo })
      .getRawOne();

    const totalGoodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    const totalDefectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const totalQty = totalGoodQty + totalDefectQty;

    return {
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
