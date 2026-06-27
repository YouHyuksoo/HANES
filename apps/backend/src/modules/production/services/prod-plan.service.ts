/**
 * @file src/modules/production/services/prod-plan.service.ts
 * @description 월간생산계획 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **CRUD**: 개별/일괄 생성, 수정, 삭제
 * 2. **상태 관리**: DRAFT → CONFIRMED → CLOSED 워크플로우
 * 3. **planNo 자동생성**: PP-YYYYMM-NNN 형식
 * 4. **트랜잭션**: bulkCreate는 전체 원자성 보장
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryRunner } from 'typeorm';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { ItemMaster } from '../../../entities/item-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { RoutingProcess } from '../../../entities/routing-process.entity';
import { NumberingService } from '../../../shared/numbering.service';
import { TransactionService } from '../../../shared/transaction.service';
import {
  CreateProdPlanDto,
  BulkCreateProdPlanDto,
  UpdateProdPlanDto,
  ProdPlanQueryDto,
  IssueJobOrderFromPlanDto,
} from '../dto/prod-plan.dto';
import { parseDateStart } from '../../../shared/date.util';

@Injectable()
export class ProdPlanService {
  private readonly logger = new Logger(ProdPlanService.name);

  constructor(
    @InjectRepository(ProdPlan)
    private readonly planRepo: Repository<ProdPlan>,
    @InjectRepository(ItemMaster)
    private readonly partRepo: Repository<ItemMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(RoutingGroup)
    private readonly routingGroupRepo: Repository<RoutingGroup>,
    @InjectRepository(BomMaster)
    private readonly bomMasterRepo: Repository<BomMaster>,
    @InjectRepository(RoutingProcess)
    private readonly routingProcessRepo: Repository<RoutingProcess>,
    private readonly numbering: NumberingService,
    private readonly tx: TransactionService,
  ) {}

  private async resolveRoutingCodeByItem(itemCode: string, company?: string | null, plant?: string | null): Promise<string | null> {
    const group = await this.routingGroupRepo.findOne({
      where: {
        itemCode,
        useYn: 'Y',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    return group?.routingCode ?? null;
  }

  /** 목록 조회 (필터, 페이징, part join) */
  async findAll(query: ProdPlanQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, planMonth, itemType, status, search, fromDate, toDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.planRepo
      .createQueryBuilder('pp')
      .leftJoinAndSelect('pp.part', 'part');

    if (company) qb.andWhere('pp.company = :company', { company });
    if (plant) qb.andWhere('pp.plant = :plant', { plant });
    if (planMonth) qb.andWhere('pp.planMonth = :planMonth', { planMonth });
    if (fromDate) qb.andWhere('pp.planMonth >= :startMonth', { startMonth: fromDate.slice(0, 7) });
    if (toDate) qb.andWhere('pp.planMonth <= :endMonth', { endMonth: toDate.slice(0, 7) });
    if (itemType) qb.andWhere('pp.itemType = :itemType', { itemType });
    if (status) qb.andWhere('pp.status = :status', { status });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(pp.planNo LIKE :search OR pp.itemCode LIKE :search OR part.itemName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }

    qb.orderBy('pp.priority', 'ASC')
      .addOrderBy('pp.createdAt', 'DESC');

    const total = await qb.getCount();
    const data = await qb.skip(skip).take(limit).getMany();
    return { data, total, page, limit };
  }

  /** 개별 등록 (planNo 자동생성) */
  async create(dto: CreateProdPlanDto, company?: string, plant?: string) {
    const part = await this.partRepo.findOne({
      where: { itemCode: dto.itemCode, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
    });
    if (!part) throw new NotFoundException(`품목을 찾을 수 없습니다: ${dto.itemCode}`);

    const planNo = await this.generatePlanNo(dto.planMonth);

    const plan = this.planRepo.create({
      planNo,
      planMonth: dto.planMonth,
      itemCode: dto.itemCode,
      itemType: dto.itemType,
      planQty: dto.planQty,
      customer: dto.customer || null,
      lineCode: dto.lineCode || null,
      priority: dto.priority ?? 5,
      remark: dto.remark || null,
      status: 'DRAFT',
      company: company || null,
      plant: plant || null,
    });

    const saved = await this.planRepo.save(plan);
    return this.planRepo.findOne({
      where: { planNo: saved.planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
  }

  /** 엑셀 일괄 등록 (트랜잭션) */
  async bulkCreate(dto: BulkCreateProdPlanDto, company?: string, plant?: string) {
    return this.tx.run(async (queryRunner) => {
      const results: ProdPlan[] = [];

      // IN 배치 선조회로 품목 검증 (N+1 제거)
      const allItemCodes = [...new Set(dto.items.map((i) => i.itemCode))];
      const allParts = allItemCodes.length > 0
        ? await queryRunner.manager.find(ItemMaster, {
            where: { itemCode: In(allItemCodes), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
            select: ['itemCode'],
          })
        : [];
      const validItemCodes = new Set(allParts.map((p) => p.itemCode));
      for (const code of allItemCodes) {
        if (!validItemCodes.has(code)) {
          throw new BadRequestException(`품목을 찾을 수 없습니다: ${code}`);
        }
      }

      for (const item of dto.items) {
        const planNo = await this.generatePlanNo(dto.planMonth, queryRunner);

        const plan = queryRunner.manager.create(ProdPlan, {
          planNo,
          planMonth: dto.planMonth,
          itemCode: item.itemCode,
          itemType: item.itemType,
          planQty: item.planQty,
          customer: item.customer || null,
          lineCode: item.lineCode || null,
          priority: item.priority ?? 5,
          remark: item.remark || null,
          status: 'DRAFT',
          company: company || null,
          plant: plant || null,
        });

        const saved = await queryRunner.manager.save(plan);
        results.push(saved);
      }

      return { count: results.length, items: results };
    });
  }

  /** 수정 (DRAFT 상태만) */
  async update(planNo: string, dto: UpdateProdPlanDto, company?: string, plant?: string) {
    const plan = await this.findById(planNo, company, plant);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 수정할 수 있습니다.');
    }

    const updateData: Partial<ProdPlan> = {};
    if (dto.itemCode !== undefined) updateData.itemCode = dto.itemCode;
    if (dto.itemType !== undefined) updateData.itemType = dto.itemType;
    if (dto.planQty !== undefined) updateData.planQty = dto.planQty;
    if (dto.customer !== undefined) updateData.customer = dto.customer || null;
    if (dto.lineCode !== undefined) updateData.lineCode = dto.lineCode || null;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.remark !== undefined) updateData.remark = dto.remark || null;

    await this.planRepo.update({ planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) }, updateData);
    return this.planRepo.findOne({
      where: { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
  }

  /** 삭제 (DRAFT 상태만) */
  async delete(planNo: string, company?: string, plant?: string) {
    const plan = await this.findById(planNo, company, plant);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 삭제할 수 있습니다.');
    }
    await this.planRepo.delete({ planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) });
    return { planNo };
  }

  /** 확정 (DRAFT → CONFIRMED) */
  async confirm(planNo: string, company?: string, plant?: string) {
    const plan = await this.findById(planNo, company, plant);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 확정할 수 있습니다.');
    }
    await this.planRepo.update(
      { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      { status: 'CONFIRMED' },
    );
    return this.planRepo.findOne({
      where: { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
  }

  /** 일괄 확정 — IN 배치 선조회 + 일괄 UPDATE (N+1 제거) */
  async bulkConfirm(planNos: string[], company?: string, plant?: string) {
    if (planNos.length === 0) return { count: 0 };

    const plans = await this.planRepo.find({
      where: { planNo: In(planNos), ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      select: ['planNo', 'status'],
    });

    const draftPlanNos = plans
      .filter((p) => p.status === 'DRAFT')
      .map((p) => p.planNo);

    if (draftPlanNos.length === 0) return { count: 0 };

    const qb = this.planRepo
      .createQueryBuilder()
      .update(ProdPlan)
      .set({ status: 'CONFIRMED' })
      .where('planNo IN (:...planNos)', { planNos: draftPlanNos });
    if (company) qb.andWhere('company = :company', { company });
    if (plant) qb.andWhere('plant = :plant', { plant });
    await qb.execute();

    return { count: draftPlanNos.length };
  }

  /** 확정 취소 (CONFIRMED → DRAFT) */
  async unconfirm(planNo: string, company?: string, plant?: string) {
    const plan = await this.findById(planNo, company, plant);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 취소할 수 있습니다.');
    }
    await this.planRepo.update(
      { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      { status: 'DRAFT' },
    );
    return this.planRepo.findOne({
      where: { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
  }

  /** 마감 (CONFIRMED → CLOSED) */
  async close(planNo: string, company?: string, plant?: string) {
    const plan = await this.findById(planNo, company, plant);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 마감할 수 있습니다.');
    }
    await this.planRepo.update(
      { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      { status: 'CLOSED' },
    );
    return this.planRepo.findOne({
      where: { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
  }

  /** 월간 집계 (FG/WIP별 수량, 상태별 건수) */
  async getSummary(month: string, company?: string, plant?: string) {
    const qb = this.planRepo.createQueryBuilder('pp')
      .where('pp.planMonth = :month', { month });
    if (company) qb.andWhere('pp.company = :company', { company });
    if (plant) qb.andWhere('pp.plant = :plant', { plant });

    const [plans, total] = await qb.getManyAndCount();

    const summary = {
      total,
      draft: 0,
      confirmed: 0,
      closed: 0,
      fgCount: 0,
      wipCount: 0,
      fgPlanQty: 0,
      wipPlanQty: 0,
      totalPlanQty: 0,
      totalOrderQty: 0,
    };

    for (const p of plans) {
      if (p.status === 'DRAFT') summary.draft++;
      else if (p.status === 'CONFIRMED') summary.confirmed++;
      else if (p.status === 'CLOSED') summary.closed++;

      if (p.itemType === 'FINISHED') {
        summary.fgCount++;
        summary.fgPlanQty += p.planQty;
      } else {
        summary.wipCount++;
        summary.wipPlanQty += p.planQty;
      }

      summary.totalPlanQty += p.planQty;
      summary.totalOrderQty += p.orderQty;
    }

    return summary;
  }

  /**
   * 생산계획에서 작업지시 발행
   * - CONFIRMED 상태만 발행 가능
   * - 잔여수량(planQty - orderQty) 초과 불가
   * - 트랜잭션으로 JobOrder 생성 + ProdPlan.orderQty 증가 원자성 보장
   */
  async issueJobOrder(planNo: string, dto: IssueJobOrderFromPlanDto, company?: string, plant?: string) {
    const plan = await this.findById(planNo, company, plant);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 작업지시를 발행할 수 있습니다.');
    }

    const remainQty = plan.planQty - plan.orderQty;
    if (dto.issueQty > remainQty) {
      throw new BadRequestException(`발행수량(${dto.issueQty})이 잔여수량(${remainQty})을 초과합니다.`);
    }

    return this.tx.run(async (queryRunner) => {
      const orderNo = await this.numbering.nextJobOrderNo(queryRunner);

      const routingCode = await this.resolveRoutingCodeByItem(plan.itemCode, company, plant);

      const rootProcessCode = await this.resolveFirstProcessCode(routingCode, company, plant);

      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo,
        planNo,
        itemCode: plan.itemCode,
        rootOrderNo: null,
        lineCode: dto.lineCode || plan.lineCode || null,
        routingCode,
        processCode: rootProcessCode,
        equipCode: null,
        planQty: dto.issueQty,
        planDate: parseDateStart(dto.planDate),
        priority: dto.priority ?? plan.priority,
        custPoNo: null,
        remark: dto.remark || `${plan.planNo}에서 발행`,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
      });
      const saved = await queryRunner.manager.save(jobOrder);

      if (dto.autoCreateChildren) {
        await this.createChildOrdersFromPlanRecursive(queryRunner, saved, saved.orderNo, company, plant, 0, new Set());
      }

      await queryRunner.manager
        .createQueryBuilder()
        .update(ProdPlan)
        .set({ orderQty: () => `ORDER_QTY + ${dto.issueQty}` })
        .where('planNo = :planNo', { planNo })
        .andWhere(company ? 'company = :company' : '1=1', { company })
        .andWhere(plant ? 'plant = :plant' : '1=1', { plant })
        .execute();

      return {
        orderNo: saved.orderNo,
        planNo,
        issueQty: dto.issueQty,
        remainQty: remainQty - dto.issueQty,
      };
    });
  }

  /**
   * BOM 기반 반제품 자식 작업지시 재귀 자동생성
   * - BOM 하위 레벨 깊이에 관계없이 전 계층 반제품(SEMI_PRODUCT)을 모두 생성한다.
   * - 깊이 제한 대신 BOM 순환참조(조상 경로 추적) 가드로 무한루프를 막고, 깊이 50은 비정상 데이터 백스톱이다.
   */
  private async createChildOrdersFromPlanRecursive(
    queryRunner: import('typeorm').QueryRunner,
    parent: JobOrder,
    rootOrderNo: string,
    company?: string,
    plant?: string,
    depth: number = 0,
    ancestorItemCodes: Set<string> = new Set(),
  ): Promise<void> {
    if (ancestorItemCodes.has(parent.itemCode)) {
      this.logger.warn(
        `BOM 순환참조 감지로 전개 중단: ${parent.itemCode} (root=${rootOrderNo}, 경로=${[...ancestorItemCodes].join('>')})`,
      );
      return;
    }
    if (depth >= 50) {
      this.logger.warn(`BOM 전개 깊이 50 초과로 중단: ${parent.itemCode} (root=${rootOrderNo})`);
      return;
    }
    const nextAncestors = new Set(ancestorItemCodes).add(parent.itemCode);

    const bomItems = await this.bomMasterRepo.find({
      where: {
        parentItemCode: parent.itemCode,
        useYn: 'Y',
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    if (bomItems.length === 0) return;

    const wipParts = await this.partRepo
      .createQueryBuilder('p')
      .where('p.itemCode IN (:...ids)', { ids: bomItems.map(b => b.childItemCode) })
      .andWhere('p.itemType = :type', { type: 'SEMI_PRODUCT' })
      .andWhere(company ? 'p.company = :company' : '1=1', { company })
      .andWhere(plant ? 'p.plant = :plant' : '1=1', { plant })
      .getMany();

    const wipPartIds = new Set(wipParts.map(p => p.itemCode));

    for (const bom of bomItems) {
      if (!wipPartIds.has(bom.childItemCode)) continue;

      const childRoutingCode = await this.resolveRoutingCodeByItem(bom.childItemCode, company, plant);
      const childProcessCode = await this.resolveFirstProcessCode(childRoutingCode, company, plant);
      const childOrderNo = await this.numbering.nextJobOrderNo(queryRunner);
      const childQty = Math.ceil(parent.planQty * Number(bom.qtyPer || 1));

      const child = await queryRunner.manager.save(
        queryRunner.manager.create(JobOrder, {
          orderNo: childOrderNo,
          parentOrderNo: parent.orderNo,
          rootOrderNo,
          planNo: parent.planNo,
          itemCode: bom.childItemCode,
          lineCode: parent.lineCode,
          routingCode: childRoutingCode,
          processCode: childProcessCode,
          equipCode: null,
          planQty: childQty,
          planDate: parent.planDate,
          priority: parent.priority,
          status: 'WAITING',
          erpSyncYn: 'N',
          company: company || null,
          plant: plant || null,
          remark: `${parent.orderNo} 하위 자동생성`,
        }),
      );

      await this.createChildOrdersFromPlanRecursive(queryRunner, child, rootOrderNo, company, plant, depth + 1, nextAncestors);
    }
  }

  private async resolveFirstProcessCode(
    routingCode: string | null,
    company?: string | null,
    plant?: string | null,
  ): Promise<string | null> {
    if (!routingCode) return null;
    const firstStep = await this.routingProcessRepo.findOne({
      where: {
        routingCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      order: { seq: 'ASC' },
    });
    return firstStep?.processCode ?? null;
  }

  /** 단건 조회 (내부) */
  private async findById(planNo: string, company?: string, plant?: string) {
    const plan = await this.planRepo.findOne({
      where: { planNo, ...(company ? { company } : {}), ...(plant ? { plant } : {}) },
      relations: ['part'],
    });
    if (!plan) throw new NotFoundException(`생산계획을 찾을 수 없습니다: ${planNo}`);
    return plan;
  }

  /** planNo 자동생성: PP-YYYYMM-NNN */
  private async generatePlanNo(planMonth: string, queryRunner?: QueryRunner): Promise<string> {
    const prefix = `PP-${planMonth.replace('-', '')}-`;
    const repo = queryRunner ? queryRunner.manager.getRepository(ProdPlan) : this.planRepo;

    const last = await repo
      .createQueryBuilder('pp')
      .where('pp.planNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('pp.planNo', 'DESC')
      .getOne();

    let seq = 1;
    if (last) {
      const lastSeq = parseInt(last.planNo.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }
}
