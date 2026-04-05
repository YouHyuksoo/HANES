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
import { Repository, DataSource, In } from 'typeorm';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { PartMaster } from '../../../entities/part-master.entity';
import { JobOrder } from '../../../entities/job-order.entity';
import { RoutingGroup } from '../../../entities/routing-group.entity';
import { BomMaster } from '../../../entities/bom-master.entity';
import { SeqGeneratorService } from '../../../shared/seq-generator.service';
import {
  CreateProdPlanDto,
  BulkCreateProdPlanDto,
  UpdateProdPlanDto,
  ProdPlanQueryDto,
  IssueJobOrderFromPlanDto,
} from '../dto/prod-plan.dto';

@Injectable()
export class ProdPlanService {
  private readonly logger = new Logger(ProdPlanService.name);

  constructor(
    @InjectRepository(ProdPlan)
    private readonly planRepo: Repository<ProdPlan>,
    @InjectRepository(PartMaster)
    private readonly partRepo: Repository<PartMaster>,
    @InjectRepository(JobOrder)
    private readonly jobOrderRepo: Repository<JobOrder>,
    @InjectRepository(RoutingGroup)
    private readonly routingGroupRepo: Repository<RoutingGroup>,
    @InjectRepository(BomMaster)
    private readonly bomMasterRepo: Repository<BomMaster>,
    private readonly seqGenerator: SeqGeneratorService,
    private readonly dataSource: DataSource,
  ) {}

  /** 목록 조회 (필터, 페이징, part join) */
  async findAll(query: ProdPlanQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, planMonth, itemType, status, search, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const qb = this.planRepo
      .createQueryBuilder('pp')
      .leftJoinAndSelect('pp.part', 'part');

    if (company) qb.andWhere('pp.company = :company', { company });
    if (plant) qb.andWhere('pp.plant = :plant', { plant });
    if (planMonth) qb.andWhere('pp.planMonth = :planMonth', { planMonth });
    if (startDate) qb.andWhere('pp.planMonth >= :startMonth', { startMonth: startDate.slice(0, 7) });
    if (endDate) qb.andWhere('pp.planMonth <= :endMonth', { endMonth: endDate.slice(0, 7) });
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
    const part = await this.partRepo.findOne({ where: { itemCode: dto.itemCode } });
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
    return this.planRepo.findOne({ where: { planNo: saved.planNo }, relations: ['part'] });
  }

  /** 엑셀 일괄 등록 (트랜잭션) */
  async bulkCreate(dto: BulkCreateProdPlanDto, company?: string, plant?: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const results: ProdPlan[] = [];

      // IN 배치 선조회로 품목 검증 (N+1 제거)
      const allItemCodes = [...new Set(dto.items.map((i) => i.itemCode))];
      const allParts = allItemCodes.length > 0
        ? await queryRunner.manager.find(PartMaster, { where: { itemCode: In(allItemCodes) }, select: ['itemCode'] })
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

      await queryRunner.commitTransaction();
      return { count: results.length, items: results };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** 수정 (DRAFT 상태만) */
  async update(planNo: string, dto: UpdateProdPlanDto) {
    const plan = await this.findById(planNo);
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

    await this.planRepo.update({ planNo }, updateData);
    return this.planRepo.findOne({ where: { planNo }, relations: ['part'] });
  }

  /** 삭제 (DRAFT 상태만) */
  async delete(planNo: string) {
    const plan = await this.findById(planNo);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 삭제할 수 있습니다.');
    }
    await this.planRepo.delete({ planNo });
    return { planNo };
  }

  /** 확정 (DRAFT → CONFIRMED) */
  async confirm(planNo: string) {
    const plan = await this.findById(planNo);
    if (plan.status !== 'DRAFT') {
      throw new BadRequestException('초안(DRAFT) 상태의 계획만 확정할 수 있습니다.');
    }
    await this.planRepo.update({ planNo }, { status: 'CONFIRMED' });
    return this.planRepo.findOne({ where: { planNo }, relations: ['part'] });
  }

  /** 일괄 확정 — IN 배치 선조회 + 일괄 UPDATE (N+1 제거) */
  async bulkConfirm(planNos: string[]) {
    if (planNos.length === 0) return { count: 0 };

    const plans = await this.planRepo.find({
      where: { planNo: In(planNos) },
      select: ['planNo', 'status'],
    });

    const draftPlanNos = plans
      .filter((p) => p.status === 'DRAFT')
      .map((p) => p.planNo);

    if (draftPlanNos.length === 0) return { count: 0 };

    await this.planRepo
      .createQueryBuilder()
      .update(ProdPlan)
      .set({ status: 'CONFIRMED' })
      .where('planNo IN (:...planNos)', { planNos: draftPlanNos })
      .execute();

    return { count: draftPlanNos.length };
  }

  /** 확정 취소 (CONFIRMED → DRAFT) */
  async unconfirm(planNo: string) {
    const plan = await this.findById(planNo);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 취소할 수 있습니다.');
    }
    await this.planRepo.update({ planNo }, { status: 'DRAFT' });
    return this.planRepo.findOne({ where: { planNo }, relations: ['part'] });
  }

  /** 마감 (CONFIRMED → CLOSED) */
  async close(planNo: string) {
    const plan = await this.findById(planNo);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 마감할 수 있습니다.');
    }
    await this.planRepo.update({ planNo }, { status: 'CLOSED' });
    return this.planRepo.findOne({ where: { planNo }, relations: ['part'] });
  }

  /** 월간 집계 (FG/WIP별 수량, 상태별 건수) */
  async getSummary(month: string) {
    const qb = this.planRepo.createQueryBuilder('pp')
      .where('pp.planMonth = :month', { month });

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

      if (p.itemType === 'FG') {
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
    const plan = await this.findById(planNo);
    if (plan.status !== 'CONFIRMED') {
      throw new BadRequestException('확정(CONFIRMED) 상태의 계획만 작업지시를 발행할 수 있습니다.');
    }

    const remainQty = plan.planQty - plan.orderQty;
    if (dto.issueQty > remainQty) {
      throw new BadRequestException(`발행수량(${dto.issueQty})이 잔여수량(${remainQty})을 초과합니다.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const orderNo = await this.seqGenerator.nextJobOrderNo(queryRunner);

      const routingGroup = await this.routingGroupRepo.findOne({
        where: { itemCode: plan.itemCode, useYn: 'Y' },
      });

      const jobOrder = queryRunner.manager.create(JobOrder, {
        orderNo,
        planNo,
        itemCode: plan.itemCode,
        lineCode: dto.lineCode || plan.lineCode || null,
        routingCode: routingGroup?.routingCode || null,
        planQty: dto.issueQty,
        planDate: dto.planDate ? new Date(dto.planDate) : null,
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
        await this.createChildOrdersFromPlan(queryRunner, saved, company, plant);
      }

      await queryRunner.manager
        .createQueryBuilder()
        .update(ProdPlan)
        .set({ orderQty: () => `ORDER_QTY + ${dto.issueQty}` })
        .where('planNo = :planNo', { planNo })
        .execute();

      await queryRunner.commitTransaction();

      return {
        orderNo: saved.orderNo,
        planNo,
        issueQty: dto.issueQty,
        remainQty: remainQty - dto.issueQty,
      };
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /** BOM 기반 반제품 자식 작업지시 자동생성 */
  private async createChildOrdersFromPlan(
    queryRunner: import('typeorm').QueryRunner,
    parent: JobOrder,
    company?: string,
    plant?: string,
  ) {
    const bomItems = await this.bomMasterRepo.find({
      where: { parentItemCode: parent.itemCode, useYn: 'Y' },
      order: { seq: 'ASC' },
    });
    if (bomItems.length === 0) return;

    const wipParts = await this.partRepo
      .createQueryBuilder('p')
      .where('p.itemCode IN (:...ids)', { ids: bomItems.map(b => b.childItemCode) })
      .andWhere('p.itemType = :type', { type: 'WIP' })
      .getMany();

    const wipPartIds = new Set(wipParts.map(p => p.itemCode));

    for (let i = 0; i < bomItems.length; i++) {
      const bom = bomItems[i];
      if (!wipPartIds.has(bom.childItemCode)) continue;

      const childRouting = await this.routingGroupRepo.findOne({
        where: { itemCode: bom.childItemCode, useYn: 'Y' },
      });

      const childOrderNo = await this.seqGenerator.nextJobOrderNo(queryRunner);
      const childQty = Math.ceil(parent.planQty * Number(bom.qtyPer || 1));

      const child = queryRunner.manager.create(JobOrder, {
        orderNo: childOrderNo,
        parentOrderNo: parent.orderNo,
        planNo: parent.planNo,
        itemCode: bom.childItemCode,
        lineCode: parent.lineCode,
        routingCode: childRouting?.routingCode || null,
        planQty: childQty,
        planDate: parent.planDate,
        priority: parent.priority,
        status: 'WAITING',
        erpSyncYn: 'N',
        company: company || null,
        plant: plant || null,
        remark: `${parent.orderNo} 하위 자동생성`,
      });
      await queryRunner.manager.save(child);
    }
  }

  /** 단건 조회 (내부) */
  private async findById(planNo: string) {
    const plan = await this.planRepo.findOne({ where: { planNo }, relations: ['part'] });
    if (!plan) throw new NotFoundException(`생산계획을 찾을 수 없습니다: ${planNo}`);
    return plan;
  }

  /** planNo 자동생성: PP-YYYYMM-NNN */
  private async generatePlanNo(planMonth: string, queryRunner?: any): Promise<string> {
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
