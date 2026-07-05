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
import { Repository, QueryRunner, FindOptionsSelect, IsNull, In, Brackets } from 'typeorm';
import { JobOrder } from '../../../entities/job-order.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { ProdResult } from '../../../entities/prod-result.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import { SysConfigService } from '../../system/services/sys-config.service';
import { FgLabel } from '../../../entities/fg-label.entity';
import {
  CreateJobOrderOperationAssignmentDto,
  CreateJobOrderDto,
  UpdateJobOrderDto,
  JobOrderQueryDto,
  ChangeJobOrderStatusDto,
  UpdateErpSyncDto,
} from '../dto/job-order.dto';
import { parseDateStart } from '../../../shared/date.util';

/** 작업지시 조회 시 공통으로 사용하는 select 필드 */
const JOB_ORDER_SELECT: FindOptionsSelect<JobOrder> = {
  orderNo: true, planNo: true, itemCode: true, lineCode: true, routingCode: true,
  processCode: true, orderKind: true, routingSeq: true, equipCode: true,
  planQty: true, planDate: true, priority: true, status: true,
  erpSyncYn: true, goodQty: true, defectQty: true,
  startAt: true, endAt: true, custPoNo: true, remark: true,
  createdAt: true, updatedAt: true,
};

export interface RoutingProcessSnapshot {
  routingCode: string;
  seq: number;
  processCode: string;
  processName: string;
  executionType: 'IN_HOUSE' | 'SUBCON';
  subconVendorCode: string | null;
}

@Injectable()
export class JobOrderService {
  private readonly logger = new Logger(JobOrderService.name);

  constructor(
    @InjectRepository(JobOrder)
    private readonly jobOrderRepository: Repository<JobOrder>,
    @InjectRepository(ItemMaster)
    private readonly itemMasterRepository: Repository<ItemMaster>,
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
    private readonly numbering: NumberingService,
    private readonly sysConfigService: SysConfigService,
    private readonly tx: TransactionService,
  ) {}

  private async resolveRoutingCodeByItem(itemCode: string, company?: string | null, plant?: string | null): Promise<string | null> {
    const group = await this.routingGroupRepository.findOne({
      where: {
        itemCode,
        useYn: 'Y',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (group) {
      this.assertSameTenant('라우팅 그룹', { company, plant }, group);
    }
    return group?.routingCode ?? null;
  }

  private async findActiveRoutingProcesses(jobOrder: Pick<JobOrder, 'routingCode'>, company?: string, plant?: string) {
    return jobOrder.routingCode
      ? this.routingProcessRepository.find({
          where: {
            routingCode: jobOrder.routingCode,
            useYn: 'Y',
            ...(company ? { company } : {}),
            ...(plant ? { plant } : {}),
          },
          order: { seq: 'ASC' },
        })
      : [];
  }

  private async findRoutingProcessesByCode(
    routingCode: string | null,
    company?: string | null,
    plant?: string | null,
  ): Promise<RoutingProcess[]> {
    if (!routingCode) return [];
    return (await this.routingProcessRepository.find({
      where: {
        routingCode,
        useYn: 'Y',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { seq: 'ASC' },
    })) ?? [];
  }

  private resolveProcessCodeForCreate(
    requestedProcessCode: string | null | undefined,
    routingCode: string,
    routingProcesses: RoutingProcess[],
  ): string | null {
    if (!requestedProcessCode) return routingProcesses[0]?.processCode ?? null;
    if (routingProcesses.length === 0) return requestedProcessCode;
    const exists = routingProcesses.some((process) => process.processCode === requestedProcessCode);
    if (!exists) {
      throw new BadRequestException(
        `선택한 공정이 라우팅에 포함되어 있지 않습니다. routing=${routingCode}, process=${requestedProcessCode}`,
      );
    }
    return requestedProcessCode;
  }

  private getJobOrderRoutingProcesses(routingProcesses: RoutingProcess[]): RoutingProcess[] {
    return routingProcesses.filter((process) => (process.jobOrderYn ?? 'Y') === 'Y');
  }

  private validateOperationAssignment(
    assignment: CreateJobOrderOperationAssignmentDto,
    routingProcesses: RoutingProcess[],
  ): RoutingProcess {
    const process = routingProcesses.find((candidate) => (
      (assignment.routingSeq == null || Number(candidate.seq) === Number(assignment.routingSeq))
      && candidate.processCode === assignment.processCode
    ));
    if (!process) {
      throw new BadRequestException(
        `라우팅에 없는 공정 설비 배정입니다: seq=${assignment.routingSeq ?? '-'}, process=${assignment.processCode}`,
      );
    }
    return process;
  }

  private buildOperationAssignmentKey(
    itemCode: string,
    routingCode: string,
    routingSeq: number,
    processCode: string,
  ): string {
    return `${itemCode}::${routingCode}::${routingSeq}::${processCode}`;
  }

  private buildOperationAssignmentMap(
    assignments: CreateJobOrderOperationAssignmentDto[] | undefined,
    itemCode: string,
    routingCode: string,
    routingProcesses: RoutingProcess[],
    includeLegacyAssignments = false,
  ): Map<number, { processCode: string; equipCode: string | null }> {
    const operationAssignmentMap = new Map<number, { processCode: string; equipCode: string | null }>();
    if (!assignments?.length) return operationAssignmentMap;

    for (const assignment of assignments) {
      const isLegacyAssignment = !assignment.itemCode && !assignment.routingCode;
      const matchesItem = assignment.itemCode === itemCode;
      const matchesRouting = !assignment.routingCode || assignment.routingCode === routingCode;
      if (!(matchesItem && matchesRouting) && !(includeLegacyAssignments && isLegacyAssignment)) {
        continue;
      }
      const process = this.validateOperationAssignment(assignment, routingProcesses);
      if (operationAssignmentMap.has(Number(process.seq))) {
        const assignmentKey = this.buildOperationAssignmentKey(itemCode, routingCode, Number(process.seq), process.processCode);
        throw new BadRequestException(`중복된 공정 설비 배정입니다: ${assignmentKey}`);
      }
      operationAssignmentMap.set(Number(process.seq), {
        processCode: process.processCode,
        equipCode: assignment.equipCode?.trim() || null,
      });
    }
    return operationAssignmentMap;
  }

  private getAssignmentsForItemRouting(
    assignments: CreateJobOrderOperationAssignmentDto[] | undefined,
    itemCode: string,
    routingCode: string,
    routingProcesses: RoutingProcess[],
    includeLegacyAssignments = false,
  ): Map<number, { processCode: string; equipCode: string | null }> {
    return this.buildOperationAssignmentMap(
      assignments,
      itemCode,
      routingCode,
      routingProcesses,
      includeLegacyAssignments,
    );
  }

  private async createRoutingOperationOrders(
    queryRunner: QueryRunner,
    itemOrder: JobOrder,
    routingProcesses: RoutingProcess[],
    rootOrderNo: string,
    operationAssignmentMap: Map<number, { processCode: string; equipCode: string | null }>,
  ): Promise<void> {
    for (const process of this.getJobOrderRoutingProcesses(routingProcesses)) {
      const operationOrderNo = await this.numbering.nextJobOrderNo(queryRunner);
      const assignment = operationAssignmentMap.get(Number(process.seq));
      await queryRunner.manager.save(
        queryRunner.manager.create(JobOrder, {
          orderNo: operationOrderNo,
          itemCode: itemOrder.itemCode,
          parentOrderNo: itemOrder.orderNo,
          rootOrderNo,
          lineCode: itemOrder.lineCode,
          routingCode: itemOrder.routingCode,
          processCode: process.processCode,
          orderKind: 'OPERATION',
          routingSeq: process.seq,
          equipCode: assignment?.equipCode ?? null,
          planQty: itemOrder.planQty,
          planDate: itemOrder.planDate,
          priority: itemOrder.priority,
          custPoNo: itemOrder.custPoNo,
          remark: `[공정작업] ${itemOrder.orderNo} ${process.seq}-${process.processName ?? process.processCode}`,
          status: 'WAITING',
          erpSyncYn: 'N',
          company: itemOrder.company,
          plant: itemOrder.plant,
        }),
      );
    }
  }

  private toRoutingProcessSnapshot(process: RoutingProcess | undefined): RoutingProcessSnapshot | null {
    if (!process) return null;
    return {
      routingCode: process.routingCode,
      seq: process.seq,
      processCode: process.processCode,
      processName: process.processName,
      executionType: process.executionType ?? 'IN_HOUSE',
      subconVendorCode: process.subconVendorCode ?? null,
    };
  }

  private resolveRoutingFlow(jobOrder: Pick<JobOrder, 'processCode'>, routingProcesses: RoutingProcess[]) {
    const currentIndex = routingProcesses.findIndex((process) => process.processCode === jobOrder.processCode);
    const currentRoutingProcess = currentIndex >= 0 ? routingProcesses[currentIndex] : undefined;
    const nextRoutingProcess = currentIndex >= 0 ? routingProcesses[currentIndex + 1] : undefined;
    return {
      currentRoutingProcess: this.toRoutingProcessSnapshot(currentRoutingProcess),
      nextRoutingProcess: this.toRoutingProcessSnapshot(nextRoutingProcess),
    };
  }

  private assertSameTenant(
    context: string,
    requested: { company?: string | null; plant?: string | null },
    actual: { company?: string | null; plant?: string | null },
  ) {
    if (requested.company && actual.company !== requested.company) {
      throw new BadRequestException(
        `${context} 회사 정보가 일치하지 않습니다. request=${requested.company}, row=${actual.company ?? 'NULL'}`,
      );
    }
    if (requested.plant && actual.plant !== requested.plant) {
      throw new BadRequestException(
        `${context} 사업장 정보가 일치하지 않습니다. request=${requested.plant}, row=${actual.plant ?? 'NULL'}`,
      );
    }
  }

  /** 작업지시 단건 조회 + select 필드 적용 (내부 헬퍼) */
  private findOneWithSelect(orderNo: string, company?: string, plant?: string) {
    return this.jobOrderRepository.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) }, relations: ['part'], select: JOB_ORDER_SELECT,
    });
  }

  /** 작업지시 목록 조회 */
  async findAll(query: JobOrderQueryDto, company?: string, plant?: string) {
    const {
      page = 1, limit = 50, search, orderNo, itemCode,
      lineCode, equipCode, status, statuses, planDateFrom, planDateTo, erpSyncYn,
      itemType, processCode,
      orderKind, assignableEquipCode,
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
    if (equipCode) {
      const conditions = [
        'EXISTS (SELECT 1 FROM PROD_RESULTS pr',
        'WHERE pr.ORDER_NO = jo.ORDER_NO',
        'AND pr.EQUIP_CODE = :equipCode',
      ];
      if (company) conditions.push('AND pr.COMPANY = :company');
      if (plant) conditions.push('AND pr.PLANT_CD = :plant');
      conditions.push(')');
      qb.andWhere(conditions.join(' '), { equipCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) });
    }
    if (assignableEquipCode) {
      qb.andWhere('(jo.equipCode IS NULL OR jo.equipCode = :assignableEquipCode)', { assignableEquipCode });
    }
    if (statuses) {
      const statusList = statuses.split(',').map(s => s.trim()).filter(Boolean);
      if (statusList.length > 0) qb.andWhere('jo.status IN (:...statusList)', { statusList });
    } else if (status) {
      qb.andWhere('jo.status = :status', { status });
    }
    if (erpSyncYn) qb.andWhere('jo.erpSyncYn = :erpSyncYn', { erpSyncYn });
    if (itemType) qb.andWhere('part.itemType = :itemType', { itemType });
    if (processCode) qb.andWhere('jo.processCode = :processCode', { processCode });
    if (orderKind) qb.andWhere('jo.orderKind = :orderKind', { orderKind });
    // 계획일 필터: 범위 내 작업지시 + 계획일 미지정(NULL) 작업지시는 항상 노출
    // (NULL은 범위 비교에서 제외되어 즉시지시/계획일 미입력 건이 숨겨지던 문제 해소)
    if (planDateFrom || planDateTo) {
      qb.andWhere(new Brackets((qb2) => {
        qb2.where('jo.planDate IS NULL');
        // 컬럼에 TRUNC를 걸지 않고 [시작, 종료+1) 범위로 비교(인덱스 보존 + 종료일 풀데이 포함)
        if (planDateFrom && planDateTo) {
          qb2.orWhere("(jo.planDate >= TO_DATE(:planDateFrom, 'YYYY-MM-DD') AND jo.planDate < TO_DATE(:planDateTo, 'YYYY-MM-DD') + 1)", {
            planDateFrom, planDateTo,
          });
        } else if (planDateFrom) {
          qb2.orWhere("jo.planDate >= TO_DATE(:planDateFrom, 'YYYY-MM-DD')", { planDateFrom });
        } else {
          qb2.orWhere("jo.planDate < TO_DATE(:planDateTo, 'YYYY-MM-DD') + 1", { planDateTo });
        }
      }));
    }
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
  async findById(orderNo: string, company?: string, plant?: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part', 'routing'],
    });
    if (!jobOrder) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);
    this.assertSameTenant('작업지시', { company, plant }, jobOrder);
    return jobOrder;
  }

  /** 작업지시 상세 조회 (orderNo) - API용 (prodResults 최근 10건 포함, DB 레벨 제한) */
  async findByIdWithResults(orderNo: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(orderNo, company, plant);
    const prQb = this.prodResultRepository
      .createQueryBuilder('pr')
      .where('pr.orderNo = :orderNo', { orderNo })
      .orderBy('pr.createdAt', 'DESC')
      .take(10);
    if (company) prQb.andWhere('pr.company = :company', { company });
    if (plant) prQb.andWhere('pr.plant = :plant', { plant });
    const prodResults = await prQb.getMany();
    const routingProcesses = await this.findActiveRoutingProcesses(jobOrder, company, plant);
    return { ...jobOrder, prodResults, routingProcesses, ...this.resolveRoutingFlow(jobOrder, routingProcesses) };
  }

  /** 작업지시 단건 조회 (작업지시번호) */
  async findByOrderNo(orderNo: string, company?: string, plant?: string) {
    const jobOrder = await this.jobOrderRepository.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part', 'routing'],
    });
    if (!jobOrder) throw new NotFoundException(`작업지시를 찾을 수 없습니다: ${orderNo}`);

    // 실적 집계 반영 — 키오스크 등 바코드 스캔 진입점이 실제 생산 진행량을 보도록
    // findAll/findById와 동일하게 PROD_RESULTS 합계로 goodQty/defectQty를 채운다 (CANCELED 제외).
    const summaryQb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .where('pr.orderNo = :orderNo', { orderNo: jobOrder.orderNo })
      .andWhere('pr.status != :canceled', { canceled: 'CANCELED' });
    if (company) summaryQb.andWhere('pr.company = :company', { company });
    if (plant) summaryQb.andWhere('pr.plant = :plant', { plant });
    const summary = await summaryQb.getRawOne();

    jobOrder.goodQty = summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0;
    jobOrder.defectQty = summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0;
    const routingProcesses = await this.findActiveRoutingProcesses(jobOrder, company, plant);
    return { ...jobOrder, ...this.resolveRoutingFlow(jobOrder, routingProcesses) };
  }

  /** 작업지시 생성 (트랜잭션 처리, company/plant 포함) */
  async create(dto: CreateJobOrderDto, company?: string, plant?: string) {
    const orderNo = dto.orderNo ?? await this.numbering.nextJobOrderNo();

    const existing = await this.jobOrderRepository.findOne({
      where: { orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (existing) throw new ConflictException(`이미 존재하는 작업지시번호입니다: ${orderNo}`);

    const part = await this.itemMasterRepository.findOne({
      where: { itemCode: dto.itemCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);
    this.assertSameTenant('품목', { company, plant }, part);

    // 품목 기반 라우팅 자동 조회 — 라우팅은 필수(공정별 발행·차감·라벨이 라우팅에 걸림)
    const routingCode = await this.resolveRoutingCodeByItem(dto.itemCode, company, plant);
    if (!routingCode) {
      throw new BadRequestException(
        `작업지시 품목에 라우팅이 지정되지 않았습니다: ${dto.itemCode}. 라우팅 없는 작업지시는 생성할 수 없습니다.`,
      );
    }

    return this.tx.run(async (queryRunner) => {
      const routingProcesses = await this.findRoutingProcessesByCode(routingCode, company, plant);
      const operationAssignmentMap = this.getAssignmentsForItemRouting(
        dto.operationAssignments,
        dto.itemCode,
        routingCode,
        this.getJobOrderRoutingProcesses(routingProcesses),
        true,
      );
      const processCode = this.resolveProcessCodeForCreate(
        dto.processCode,
        routingCode,
        this.getJobOrderRoutingProcesses(routingProcesses),
      );

      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo,
        itemCode: dto.itemCode,
        parentOrderNo: dto.parentId || null,
        rootOrderNo: null,
        lineCode: dto.lineCode,
        routingCode,
        processCode,
        orderKind: 'ITEM',
        routingSeq: null,
        equipCode: dto.equipCode ?? null,
        planQty: dto.planQty,
        planDate: parseDateStart(dto.planDate),
        priority: dto.priority ?? 5,
        custPoNo: dto.custPoNo || null,
        remark: dto.remark,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
      const saved = await queryRunner.manager.save(jobOrder);

      await this.createRoutingOperationOrders(queryRunner, saved, routingProcesses, saved.orderNo, operationAssignmentMap);
      await this.createChildOrdersRecursive(queryRunner, saved, dto, saved.orderNo, 0, new Set());

      return this.jobOrderRepository.findOne({
        where: { orderNo: saved.orderNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
        relations: ['part', 'routing', 'children', 'children.part', 'children.routing'],
      });
    });
  }

  /**
   * BOM 기반 반제품 작업지시 재귀 자동생성
   * - BOM 하위 레벨 깊이에 관계없이 전 계층의 반제품(SEMI_PRODUCT)을 모두 생성한다.
   * - 깊이 제한은 두지 않되, BOM 순환참조(A→…→A)는 조상 경로 추적으로 차단해 무한루프를 막는다.
   * - depth는 안전 상한(50) 백스톱 용도로만 사용한다(정상 BOM 깊이를 초과하는 비정상 데이터 방어).
   */
  private async createChildOrdersRecursive(
    queryRunner: QueryRunner,
    parent: JobOrder,
    dto: CreateJobOrderDto,
    rootOrderNo: string,
    depth: number,
    ancestorItemCodes: Set<string>,
  ): Promise<void> {
    // BOM 순환참조 방지: 현재 품목이 이미 조상 경로에 있으면 사이클 → 중단
    if (ancestorItemCodes.has(parent.itemCode)) {
      this.logger.warn(
        `BOM 순환참조 감지로 전개 중단: ${parent.itemCode} (root=${rootOrderNo}, 경로=${[...ancestorItemCodes].join('>')})`,
      );
      return;
    }
    // 비정상 데이터 백스톱(정상 BOM은 이 깊이에 도달하지 않음)
    if (depth >= 50) {
      this.logger.warn(`BOM 전개 깊이 50 초과로 중단: ${parent.itemCode} (root=${rootOrderNo})`);
      return;
    }
    const nextAncestors = new Set(ancestorItemCodes).add(parent.itemCode);

    const bomItems = await this.bomMasterRepository.find({
      where: {
        parentItemCode: parent.itemCode,
        useYn: 'Y',
        ...(parent.company ? { company: parent.company } : {}),
        ...(parent.plant ? { plant: parent.plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    if (bomItems.length === 0) return;

    const wipParts = await this.itemMasterRepository
      .createQueryBuilder('p')
      .where('p.itemCode IN (:...ids)', { ids: bomItems.map(b => b.childItemCode) })
      .andWhere('p.itemType = :type', { type: 'SEMI_PRODUCT' })
      .andWhere(parent.company ? 'p.company = :company' : '1=1', { company: parent.company })
      .andWhere(parent.plant ? 'p.plant = :plant' : '1=1', { plant: parent.plant })
      .getMany();

    const wipPartIds = new Set(wipParts.map(p => p.itemCode));
    let childSeq = 0;

    for (const bom of bomItems) {
      if (!wipPartIds.has(bom.childItemCode)) continue;
      childSeq++;

      const childRoutingCode = await this.resolveRoutingCodeByItem(bom.childItemCode, parent.company, parent.plant);
      if (!childRoutingCode) {
        throw new BadRequestException(
          `반제품에 라우팅이 지정되지 않았습니다: ${bom.childItemCode}. 라우팅 없는 반제품 작업지시는 생성할 수 없습니다.`,
        );
      }
      const childRoutingProcesses = await this.findRoutingProcessesByCode(childRoutingCode, parent.company, parent.plant);
      const childProcessCode = this.resolveProcessCodeForCreate(
        null,
        childRoutingCode,
        this.getJobOrderRoutingProcesses(childRoutingProcesses),
      );

      const childOrderNo = await this.numbering.nextJobOrderNo(queryRunner);

      const child = await queryRunner.manager.save(
        queryRunner.manager.create(JobOrder, {
          orderNo: childOrderNo,
          itemCode: bom.childItemCode,
          parentOrderNo: parent.orderNo,
          rootOrderNo,
          lineCode: dto.lineCode,
          routingCode: childRoutingCode,
          processCode: childProcessCode,
          orderKind: 'ITEM',
          routingSeq: null,
          equipCode: null,
          planQty: Math.ceil(parent.planQty * Number(bom.qtyPer)),
          planDate: parseDateStart(dto.planDate),
          priority: dto.priority ?? 5,
          remark: `[자동생성] ${parent.orderNo}의 반제품`,
          status: 'WAITING',
          erpSyncYn: 'N',
          company: parent.company,
          plant: parent.plant,
        }),
      );

      const childOperationAssignmentMap = this.getAssignmentsForItemRouting(
        dto.operationAssignments,
        child.itemCode,
        childRoutingCode,
        this.getJobOrderRoutingProcesses(childRoutingProcesses),
      );
      await this.createRoutingOperationOrders(queryRunner, child, childRoutingProcesses, rootOrderNo, childOperationAssignmentMap);
      await this.createChildOrdersRecursive(queryRunner, child, dto, rootOrderNo, depth + 1, nextAncestors);
    }
  }

  /** 작업지시 트리 조회 (전 계층 — 메모리 조립 방식으로 임의 깊이 지원) */
  async findTree(
    parentOrderNo?: string,
    company?: string,
    plant?: string,
    planDateFrom?: string,
    planDateTo?: string,
  ) {
    const qb = this.jobOrderRepository
      .createQueryBuilder('jo')
      .leftJoinAndSelect('jo.part', 'part')
      .leftJoinAndSelect('jo.routing', 'routing')
      .orderBy('jo.planDate', 'DESC')
      .addOrderBy('jo.createdAt', 'ASC')
      .take(2000);

    if (parentOrderNo) qb.andWhere('jo.parentOrderNo IS NULL');
    if (company) qb.andWhere('jo.company = :company', { company });
    if (plant) qb.andWhere('jo.plant = :plant', { plant });

    // 계획일 필터: 범위 내 + 계획일 미지정(NULL)은 항상 노출 (목록 조회와 동일 정책)
    if (planDateFrom || planDateTo) {
      qb.andWhere(
        new Brackets((qb2) => {
          qb2.where('jo.planDate IS NULL');
          // 컬럼에 TRUNC를 걸지 않고 [시작, 종료+1) 범위로 비교(인덱스 보존 + 종료일 풀데이 포함)
          if (planDateFrom && planDateTo) {
            qb2.orWhere(
              "(jo.planDate >= TO_DATE(:treePdf, 'YYYY-MM-DD') AND jo.planDate < TO_DATE(:treePdt, 'YYYY-MM-DD') + 1)",
              { treePdf: planDateFrom, treePdt: planDateTo },
            );
          } else if (planDateFrom) {
            qb2.orWhere("jo.planDate >= TO_DATE(:treePdf, 'YYYY-MM-DD')", { treePdf: planDateFrom });
          } else {
            qb2.orWhere("jo.planDate < TO_DATE(:treePdt, 'YYYY-MM-DD') + 1", { treePdt: planDateTo });
          }
        }),
      );
    }

    const all = await qb.getMany();

    type Node = JobOrder & { children: Node[] };
    const map = new Map<string, Node>();
    for (const o of all) map.set(o.orderNo, { ...o, children: [] });

    const roots: Node[] = [];
    for (const node of map.values()) {
      if (node.parentOrderNo && map.has(node.parentOrderNo)) {
        map.get(node.parentOrderNo)!.children.push(node);
      } else {
        // 최상위이거나, 날짜 필터로 부모가 제외된 노드(고아)는 루트로 노출(자식 누락 방지)
        roots.push(node);
      }
    }
    return roots;
  }

  /** 작업지시 수정 */
  async update(id: string, dto: UpdateJobOrderDto, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    if (jobOrder.status === 'DONE' || jobOrder.status === 'CANCELED') {
      throw new BadRequestException(`완료되거나 취소된 작업지시는 수정할 수 없습니다.`);
    }
    if (dto.status !== undefined) {
      throw new BadRequestException(
        `작업지시 상태(${dto.status})는 직접 변경할 수 없습니다. 시작/보류/보류해제/완료/취소 전용 API를 사용해 주세요.`,
      );
    }

    const updateData: Partial<JobOrder> = {};
    // itemCode 변경 시 라우팅 재조회
    if (dto.itemCode !== undefined && dto.itemCode !== jobOrder.itemCode) {
      updateData.itemCode = dto.itemCode;
      updateData.routingCode = await this.resolveRoutingCodeByItem(dto.itemCode, company, plant);
    }
    if (dto.lineCode !== undefined) updateData.lineCode = dto.lineCode;
    if (dto.processCode !== undefined) updateData.processCode = dto.processCode || null;
    if (dto.equipCode !== undefined) updateData.equipCode = dto.equipCode || null;
    if (dto.planQty !== undefined) updateData.planQty = dto.planQty;
    if (dto.planDate !== undefined) updateData.planDate = parseDateStart(dto.planDate);
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.custPoNo !== undefined) updateData.custPoNo = dto.custPoNo;
    if (dto.remark !== undefined) updateData.remark = dto.remark;
    if (dto.goodQty !== undefined) updateData.goodQty = dto.goodQty;
    if (dto.defectQty !== undefined) updateData.defectQty = dto.defectQty;
    if (dto.parentId !== undefined) updateData.parentOrderNo = dto.parentId || null;

    await this.jobOrderRepository.update(
      { orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      updateData,
    );
    return this.findOneWithSelect(id, company, plant);
  }

  /** 작업지시 삭제 (소프트 삭제) */
  async delete(id: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    if (jobOrder.status === 'RUNNING') {
      throw new BadRequestException(`진행 중인 작업지시는 삭제할 수 없습니다.`);
    }
    await this.jobOrderRepository.delete({ orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) });
    return { id };
  }

  /** 작업 시작 (WAITING -> RUNNING) */
  async start(id: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    if (jobOrder.status !== 'WAITING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 시작할 수 없습니다. WAITING 상태여야 합니다.`,
      );
    }
    const updateData: Partial<JobOrder> = { status: 'RUNNING' };
    if (!jobOrder.startAt) updateData.startAt = new Date();

    await this.jobOrderRepository.update(
      { orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      updateData,
    );

    // FG 바코드는 조립(서브공정) 키팅 공정에서 발행한다(라우팅 ISSUE_LABEL_TYPE='FG'). START 시 사전발행하지 않는다.
    return this.findOneWithSelect(id, company, plant);
  }

  /** 홀딩 (WAITING/RUNNING -> HOLD) - 실적등록/출하 전부 차단 */
  async hold(id: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    if (jobOrder.status !== 'WAITING' && jobOrder.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 홀딩할 수 없습니다. WAITING 또는 RUNNING 상태여야 합니다.`,
      );
    }
    // 이전 상태 저장 (홀딩해제 시 복귀용)
    await this.jobOrderRepository.update({ orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) }, {
      status: 'HOLD',
      remark: `[HOLD] 이전상태:${jobOrder.status}${jobOrder.remark ? ' | ' + jobOrder.remark : ''}`,
    });
    return this.findOneWithSelect(id, company, plant);
  }

  /** 홀딩 해제 (HOLD -> 이전 상태 복귀) */
  async holdRelease(id: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
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

    await this.jobOrderRepository.update({ orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) }, {
      status: prevStatus,
      remark: originalRemark || null,
    });
    return this.findOneWithSelect(id, company, plant);
  }

  /**
   * 작업 완료 (RUNNING -> DONE)
   * 잔량이 있어도 종료 허용, 트랜잭션으로 집계+상태변경 원자성 보장
   */
  async complete(id: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    if (jobOrder.status !== 'RUNNING') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 완료할 수 없습니다. RUNNING 상태여야 합니다.`,
      );
    }

    await this.tx.run(async (queryRunner) => {
      const summaryQb = queryRunner.manager
        .createQueryBuilder(ProdResult, 'pr')
        .select('SUM(pr.goodQty)', 'totalGoodQty')
        .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
        .where('pr.orderNo = :orderNo', { orderNo: id })
        .andWhere('pr.status != :canceled', { canceled: 'CANCELED' });
      if (company) summaryQb.andWhere('pr.company = :company', { company });
      if (plant) summaryQb.andWhere('pr.plant = :plant', { plant });
      const summary = await summaryQb.getRawOne();

      await queryRunner.manager.update(JobOrder, { orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) }, {
        status: 'DONE',
        endAt: new Date(),
        goodQty: summary?.totalGoodQty ? parseInt(summary.totalGoodQty) : 0,
        defectQty: summary?.totalDefectQty ? parseInt(summary.totalDefectQty) : 0,
      });
    });

    const completed = await this.findOneWithSelect(id, company, plant);
    if (!completed) return completed;
    const routingProcesses = await this.findActiveRoutingProcesses(completed, company, plant);
    return { ...completed, ...this.resolveRoutingFlow(completed, routingProcesses) };
  }

  /** 작업 취소 (WAITING/HOLD -> CANCELED) - 실적 있으면 취소 불가 */
  async cancel(id: string, remark?: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    if (jobOrder.status !== 'WAITING' && jobOrder.status !== 'HOLD') {
      throw new BadRequestException(
        `현재 상태(${jobOrder.status})에서는 취소할 수 없습니다. WAITING 또는 HOLD 상태여야 합니다.`,
      );
    }

    // 실적 존재 여부 체크
    const resultCount = await this.prodResultRepository.count({
      where: { orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (resultCount > 0) {
      throw new BadRequestException(
        `실적이 ${resultCount}건 등록되어 있어 취소할 수 없습니다. 실적을 먼저 삭제해주세요.`,
      );
    }

    const updateData: Partial<JobOrder> = { status: 'CANCELED', endAt: new Date() };
    if (remark) updateData.remark = remark;
    await this.jobOrderRepository.update({ orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) }, updateData);

    // 생산계획 연결된 경우: orderQty 차감
    if (jobOrder.planNo) {
      const planQb = this.prodPlanRepo
        .createQueryBuilder()
        .update(ProdPlan)
        .set({ orderQty: () => `GREATEST(ORDER_QTY - ${jobOrder.planQty}, 0)` })
        .where('planNo = :planNo', { planNo: jobOrder.planNo });
      if (company) planQb.andWhere('company = :company', { company });
      if (plant) planQb.andWhere('plant = :plant', { plant });
      await planQb.execute();
    }

    return this.findOneWithSelect(id, company, plant);
  }

  /** 상태 직접 변경 (관리자용) */
  async changeStatus(id: string, dto: ChangeJobOrderStatusDto, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    throw new BadRequestException(
      [
        `작업지시 상태 직접 변경은 허용되지 않습니다. 현재 상태: ${jobOrder.status}`,
        '작업 시작/보류/보류해제/완료/취소 전용 API로만 처리하세요.',
        '후공정이 이미 진행되었을 수 있으므로 상태 점프 방식으로 우회하면 안 됩니다.',
      ].join(' '),
    );
  }

  /** ERP 동기화 플래그 업데이트 */
  async updateErpSyncYn(id: string, dto: UpdateErpSyncDto, company?: string, plant?: string) {
    await this.findById(id, company, plant);
    await this.jobOrderRepository.update(
      { orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      { erpSyncYn: dto.erpSyncYn },
    );
    return this.jobOrderRepository.findOne({
      where: { orderNo: id, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
  }

  /** ERP 미동기화 작업지시 목록 조회 */
  async findUnsyncedForErp(company?: string, plant?: string) {
    return this.jobOrderRepository.find({
      where: { erpSyncYn: 'N', status: 'DONE', ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
      select: JOB_ORDER_SELECT,
      order: { endAt: 'ASC' },
    });
  }

  /** ERP 동기화 완료 처리 (일괄) */
  async markAsSynced(orderNos: string[], company?: string, plant?: string) {
    const qb = this.jobOrderRepository
      .createQueryBuilder()
      .update()
      .set({ erpSyncYn: 'Y' })
      .where('orderNo IN (:...orderNos)', { orderNos });
    if (company) qb.andWhere('company = :company', { company });
    if (plant) qb.andWhere('plant = :plant', { plant });
    await qb.execute();
    return { count: orderNos.length };
  }

  /** 작업지시 실적 집계 */
  async getJobOrderSummary(id: string, company?: string, plant?: string) {
    const jobOrder = await this.findById(id, company, plant);
    const summaryQb = this.prodResultRepository
      .createQueryBuilder('pr')
      .select('SUM(pr.goodQty)', 'totalGoodQty')
      .addSelect('SUM(pr.defectQty)', 'totalDefectQty')
      .addSelect('AVG(pr.cycleTime)', 'avgCycleTime')
      .addSelect('COUNT(*)', 'resultCount')
      .where('pr.orderNo = :orderNo', { orderNo: jobOrder.orderNo })
      .andWhere('pr.status != :canceled', { canceled: 'CANCELED' });
    if (company) summaryQb.andWhere('pr.company = :company', { company });
    if (plant) summaryQb.andWhere('pr.plant = :plant', { plant });
    const summary = await summaryQb.getRawOne();

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
