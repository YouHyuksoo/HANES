/**
 * @file src/modules/equipment/services/pm-plan.service.ts
 * @description PM(예방보전) 계획 및 Work Order 비즈니스 로직 서비스
 *
 * 초보자 가이드:
 * 1. **PM Plan CRUD**: 계획 생성/조회/수정/삭제 (items 포함)
 * 2. **WO 관리**: 생성/실행/취소, 일괄생성
 * 3. **nextDueAt 계산**: cycleType 기반 자동 재계산
 * 4. **캘린더**: WO 기반 월별 요약/일별 상세
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PmPlan } from '../../../entities/pm-plan.entity';
import { PmPlanItem } from '../../../entities/pm-plan-item.entity';
import { PmWorkOrder } from '../../../entities/pm-work-order.entity';
import { PmWoResult } from '../../../entities/pm-wo-result.entity';
import { EquipMaster } from '../../../entities/equip-master.entity';
import {
  CreatePmPlanDto,
  UpdatePmPlanDto,
  PmPlanQueryDto,
  CreatePmWorkOrderDto,
  ExecutePmWorkOrderDto,
  PmWorkOrderQueryDto,
} from '../dto/pm-plan.dto';
import { parseDateStart } from '../../../shared/date.util';

@Injectable()
export class PmPlanService {
  constructor(
    @InjectRepository(PmPlan)
    private readonly pmPlanRepo: Repository<PmPlan>,
    @InjectRepository(PmPlanItem)
    private readonly pmPlanItemRepo: Repository<PmPlanItem>,
    @InjectRepository(PmWorkOrder)
    private readonly pmWorkOrderRepo: Repository<PmWorkOrder>,
    @InjectRepository(PmWoResult)
    private readonly pmWoResultRepo: Repository<PmWoResult>,
    @InjectRepository(EquipMaster)
    private readonly equipMasterRepo: Repository<EquipMaster>,
  ) {}

  private tenantWhere(company?: string, plant?: string) {
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

  // ─── PM Plan CRUD ────────────────────────────────────────

  /** PM 계획 목록 조회 */
  async findAllPlans(query: PmPlanQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, equipCode, pmType, search, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const qb = this.pmPlanRepo.createQueryBuilder('plan');

    if (company) qb.andWhere('plan.company = :company', { company });
    if (plant) qb.andWhere('plan.plant = :plant', { plant });
    if (equipCode) qb.andWhere('plan.equipCode = :equipCode', { equipCode });
    if (pmType) qb.andWhere('plan.pmType = :pmType', { pmType });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere(
        '(plan.planCode LIKE :search OR plan.planName LIKE :searchRaw)',
        { search: `%${upper}%`, searchRaw: `%${search}%` },
      );
    }
    if (dueDateFrom) {
      qb.andWhere("plan.nextDueAt >= TO_DATE(:dueDateFrom, 'YYYY-MM-DD')", { dueDateFrom });
    }
    if (dueDateTo) {
      qb.andWhere("plan.nextDueAt < TO_DATE(:dueDateTo, 'YYYY-MM-DD') + INTERVAL '1' DAY", { dueDateTo });
    }

    const total = await qb.getCount();

    const plans = await qb
      .orderBy('plan.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const planCodes = plans.map((p) => p.planCode);
    const equipIds = [...new Set(plans.map((p) => p.equipCode))];

    const equips = equipIds.length > 0
      ? await this.equipMasterRepo.find({
          where: { equipCode: In(equipIds), ...this.tenantWhere(company, plant) },
          select: ['equipCode', 'equipName', 'lineCode', 'equipType'],
        })
      : [];
    const equipMap = new Map(equips.map((e) => [e.equipCode, e]));

    // 계획별 항목 수 조회
    let itemCountMap = new Map<string, number>();
    if (planCodes.length > 0) {
      const itemCounts = await this.pmPlanItemRepo
        .createQueryBuilder('item')
        .select('item.pmPlanCode', 'pmPlanCode')
        .addSelect('COUNT(*)', 'cnt')
        .where('item.pmPlanCode IN (:...planCodes)', { planCodes })
        .andWhere('item.useYn = :useYn', { useYn: 'Y' })
        .groupBy('item.pmPlanCode')
        .getRawMany();
      itemCountMap = new Map(itemCounts.map((r: { pmPlanCode: string; cnt: string }) => [r.pmPlanCode, parseInt(r.cnt, 10)]));
    }

    const data = plans.map((plan) => {
      const equip = equipMap.get(plan.equipCode);
      return {
        ...plan,
        itemCount: itemCountMap.get(plan.planCode) || 0,
        equip: {
          equipCode: equip?.equipCode || plan.equipCode,
          equipName: equip?.equipName || '-',
          lineCode: equip?.lineCode || null,
          equipType: equip?.equipType || null,
        },
      };
    });

    return { data, total, page, limit };
  }

  /** PM 계획 상세 조회 (items 포함) */
  async findPlanById(planCode: string, company?: string, plant?: string) {
    const plan = await this.pmPlanRepo.findOne({
      where: {
        planCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      relations: ['items'],
    });
    if (!plan) throw new NotFoundException(`PM 계획을 찾을 수 없습니다: ${planCode}`);

    const equip = await this.equipMasterRepo.findOne({
      where: {
        equipCode: plan.equipCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
      select: ['equipCode', 'equipName', 'lineCode', 'equipType'],
    });

    if (plan.items) {
      plan.items.sort((a, b) => a.seq - b.seq);
    }

    return { ...plan, equip: equip || null };
  }

  /** PM 계획 생성 */
  async createPlan(dto: CreatePmPlanDto, company?: string, plant?: string) {
    const equip = await this.equipMasterRepo.findOne({
      where: {
        equipCode: dto.equipCode,
        ...(company ? { company } : {}),
        ...(plant ? { plant } : {}),
      },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipCode}`);
    this.assertSameTenant('PM 계획 설비', equip, company, plant);

    const nextDueAt = this.calculateNextDueAt(
      new Date(),
      dto.cycleType || 'MONTHLY',
      dto.cycleValue || 1,
      dto.cycleUnit || 'MONTH',
    );

    const plan = this.pmPlanRepo.create({
      equipCode: dto.equipCode,
      planCode: dto.planCode,
      planName: dto.planName,
      pmType: dto.pmType || 'TIME_BASED',
      cycleType: dto.cycleType || 'MONTHLY',
      cycleValue: dto.cycleValue || 1,
      cycleUnit: dto.cycleUnit || 'MONTH',
      seasonMonth: dto.seasonMonth ?? null,
      estimatedTime: dto.estimatedTime ?? null,
      description: dto.description ?? null,
      usageField: dto.usageField ?? null,
      usageThreshold: dto.usageThreshold ?? null,
      nextDueAt,
      ...(company ? { company } : {}),
      ...(plant ? { plant } : {}),
    });

    const saved = await this.pmPlanRepo.save(plan);

    if (dto.items?.length) {
      const items = dto.items.map((item) =>
        this.pmPlanItemRepo.create({
          pmPlanCode: saved.planCode,
          seq: item.seq,
          itemName: item.itemName,
          itemType: item.itemType || 'CHECK',
          description: item.description ?? null,
          criteria: item.criteria ?? null,
          sparePartCode: item.sparePartCode ?? null,
          sparePartQty: item.sparePartQty ?? 0,
          estimatedMinutes: item.estimatedMinutes ?? null,
        }),
      );
      await this.pmPlanItemRepo.save(items);
    }

    return this.findPlanById(saved.planCode, company, plant);
  }

  /** PM 계획 수정 */
  async updatePlan(planCode: string, dto: UpdatePmPlanDto, company?: string, plant?: string) {
    const plan = await this.pmPlanRepo.findOne({
      where: { planCode, ...this.tenantWhere(company, plant) },
    });
    if (!plan) throw new NotFoundException(`PM 계획을 찾을 수 없습니다: ${planCode}`);

    if (dto.equipCode !== undefined) plan.equipCode = dto.equipCode;
    if (dto.planName !== undefined) plan.planName = dto.planName;
    if (dto.pmType !== undefined) plan.pmType = dto.pmType;
    if (dto.cycleType !== undefined) plan.cycleType = dto.cycleType;
    if (dto.cycleValue !== undefined) plan.cycleValue = dto.cycleValue;
    if (dto.cycleUnit !== undefined) plan.cycleUnit = dto.cycleUnit;
    if (dto.seasonMonth !== undefined) plan.seasonMonth = dto.seasonMonth;
    if (dto.estimatedTime !== undefined) plan.estimatedTime = dto.estimatedTime;
    if (dto.description !== undefined) plan.description = dto.description;
    if (dto.usageField !== undefined) plan.usageField = dto.usageField ?? null;
    if (dto.usageThreshold !== undefined) plan.usageThreshold = dto.usageThreshold ?? null;

    if (dto.cycleType || dto.cycleValue || dto.cycleUnit) {
      plan.nextDueAt = this.calculateNextDueAt(
        plan.lastExecutedAt || new Date(),
        plan.cycleType,
        plan.cycleValue,
        plan.cycleUnit,
      );
    }

    await this.pmPlanRepo.save(plan);

    if (dto.items !== undefined) {
      await this.pmPlanItemRepo.delete({ pmPlanCode: planCode });
      if (dto.items.length > 0) {
        const items = dto.items.map((item) =>
          this.pmPlanItemRepo.create({
            pmPlanCode: planCode,
            seq: item.seq,
            itemName: item.itemName,
            itemType: item.itemType || 'CHECK',
            description: item.description ?? null,
            criteria: item.criteria ?? null,
            sparePartCode: item.sparePartCode ?? null,
            sparePartQty: item.sparePartQty ?? 0,
            estimatedMinutes: item.estimatedMinutes ?? null,
          }),
        );
        await this.pmPlanItemRepo.save(items);
      }
    }

    return this.findPlanById(planCode, company, plant);
  }

  /** PM 계획 삭제 (소프트) */
  async deletePlan(planCode: string, company?: string, plant?: string) {
    const plan = await this.pmPlanRepo.findOne({
      where: { planCode, ...this.tenantWhere(company, plant) },
    });
    if (!plan) throw new NotFoundException(`PM 계획을 찾을 수 없습니다: ${planCode}`);
    await this.pmPlanRepo.delete({ planCode, ...this.tenantWhere(company, plant) });
    return { planCode, deleted: true };
  }

  // ─── Work Order 관리 ────────────────────────────────────

  /** WO 일괄 생성 (해당 월에 nextDueAt이 도래하는 계획들) */
  async generateWorkOrders(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const fromStr = `${year}-${monthStr}-01`;
    const toStr = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const plans = await this.pmPlanRepo
      .createQueryBuilder('plan')
      .where('plan.useYn = :yn', { yn: 'Y' })
      .andWhere("plan.nextDueAt >= TO_DATE(:fromStr, 'YYYY-MM-DD')", { fromStr })
      .andWhere("plan.nextDueAt < TO_DATE(:toStr, 'YYYY-MM-DD') + INTERVAL '1' DAY", { toStr })
      .getMany();

    // USAGE_BASED 계획: currentUsage >= usageThreshold 도달한 건
    const usagePlans = await this.pmPlanRepo
      .createQueryBuilder('p')
      .where('p.useYn = :yn', { yn: 'Y' })
      .andWhere('p.pmType = :type', { type: 'USAGE_BASED' })
      .andWhere('p.usageThreshold IS NOT NULL')
      .andWhere('p.currentUsage >= p.usageThreshold')
      .getMany();

    const allPlans = [...plans, ...usagePlans];

    let created = 0;
    let skipped = 0;

    // 기간 내 기존 WO 일괄 선조회 (N+1 제거)
    const planCodes = allPlans.map((p) => p.planCode);
    const existingWos = planCodes.length > 0
      ? await this.pmWorkOrderRepo
          .createQueryBuilder('wo')
          .select(['wo.pmPlanCode', 'wo.scheduledDate', 'wo.company', 'wo.plant'])
          .where('wo.pmPlanCode IN (:...planCodes)', { planCodes })
          .andWhere("wo.scheduledDate >= TO_DATE(:fromStr, 'YYYY-MM-DD')", { fromStr })
          .andWhere("wo.scheduledDate < TO_DATE(:toStr, 'YYYY-MM-DD') + 1", { toStr })
          .getMany()
      : [];
    const existingWoSet = new Set(
      existingWos.map((wo) => `${wo.company ?? ''}::${wo.plant ?? ''}::${wo.pmPlanCode}::${this.formatDate(wo.scheduledDate)}`),
    );

    // 날짜별 최대 WO번호를 미리 조회하여 루프 안 개별 쿼리 제거
    const woSeqByDate = new Map<string, number>();

    for (const plan of allPlans) {
      const scheduledDate = plan.nextDueAt || startDate;
      const dateStr = this.formatDate(scheduledDate);

      if (existingWoSet.has(`${plan.company ?? ''}::${plan.plant ?? ''}::${plan.planCode}::${dateStr}`)) {
        skipped++;
        continue;
      }

      // 날짜별 seq 관리 (첫 조회만 DB, 이후는 메모리에서 증가)
      if (!woSeqByDate.has(dateStr)) {
        const prefix = `PM-${dateStr}-`;
        const lastWo = await this.pmWorkOrderRepo
          .createQueryBuilder('wo')
          .where('wo.workOrderNo LIKE :prefix', { prefix: `${prefix}%` })
          .orderBy('wo.workOrderNo', 'DESC')
          .getOne();
        let seq = 1;
        if (lastWo) {
          const lastSeq = parseInt(lastWo.workOrderNo.substring(prefix.length), 10);
          if (!isNaN(lastSeq)) seq = lastSeq + 1;
        }
        woSeqByDate.set(dateStr, seq);
      }
      const seq = woSeqByDate.get(dateStr)!;
      woSeqByDate.set(dateStr, seq + 1);
      const workOrderNo = `PM-${dateStr}-${String(seq).padStart(3, '0')}`;

      const wo = this.pmWorkOrderRepo.create({
        workOrderNo,
        pmPlanCode: plan.planCode,
        equipCode: plan.equipCode,
        woType: 'PLANNED',
        scheduledDate,
        dueDate: scheduledDate,
        status: 'PLANNED',
        priority: 'MEDIUM',
        company: plan.company,
        plant: plan.plant,
      });

      await this.pmWorkOrderRepo.save(wo);

      // USAGE_BASED: WO 생성 후 사용량 리셋
      if (plan.pmType === 'USAGE_BASED') {
        await this.pmPlanRepo.update(
          { planCode: plan.planCode, ...this.tenantWhere(plan.company ?? undefined, plan.plant ?? undefined) },
          { currentUsage: 0 },
        );
      }

      created++;
    }

    return { created, skipped, total: allPlans.length };
  }

  /** WO 수동 생성 */
  async createWorkOrder(dto: CreatePmWorkOrderDto, company?: string, plant?: string) {
    const equip = await this.equipMasterRepo.findOne({
      where: { equipCode: dto.equipCode, ...this.tenantWhere(company, plant) },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipCode}`);
    this.assertSameTenant('PM 작업지시 설비', equip, company, plant);

    const dateStr = dto.scheduledDate.substring(0, 10).replace(/-/g, '');
    const workOrderNo = await this.generateWoNumber(dateStr);

    const wo = this.pmWorkOrderRepo.create({
      workOrderNo,
      pmPlanCode: dto.pmPlanId || null,
      equipCode: dto.equipCode,
      woType: dto.woType || 'PLANNED',
      scheduledDate: parseDateStart(dto.scheduledDate)!,
      dueDate: parseDateStart(dto.scheduledDate),
      status: 'PLANNED',
      priority: dto.priority || 'MEDIUM',
      assignedWorkerCode: dto.assignedWorkerId || null,
      ...this.tenantWhere(company, plant),
    });

    const saved = await this.pmWorkOrderRepo.save(wo);
    return saved;
  }

  /** WO 실행 */
  async executeWorkOrder(workOrderNo: string, dto: ExecutePmWorkOrderDto, company?: string, plant?: string) {
    const wo = await this.pmWorkOrderRepo.findOne({
      where: { workOrderNo, ...this.tenantWhere(company, plant) },
    });
    if (!wo) throw new NotFoundException(`Work Order를 찾을 수 없습니다: ${workOrderNo}`);

    if (wo.status === 'COMPLETED' || wo.status === 'CANCELLED') {
      throw new BadRequestException(`이미 ${wo.status} 상태입니다.`);
    }

    wo.status = 'COMPLETED';
    wo.completedAt = new Date();
    wo.overallResult = dto.overallResult;
    wo.remark = dto.remark || null;
    if (dto.assignedWorkerId) wo.assignedWorkerCode = dto.assignedWorkerId;
    if (!wo.startedAt) wo.startedAt = new Date();

    await this.pmWorkOrderRepo.save(wo);

    if (dto.items?.length) {
      const results = dto.items.map((item) =>
        this.pmWoResultRepo.create({
          workOrderNo: wo.workOrderNo,
          pmPlanItemId: item.itemId ?? null,
          seq: item.seq,
          itemName: item.itemName,
          itemType: item.itemType || 'CHECK',
          criteria: item.criteria || null,
          result: item.result,
          remark: item.remark || null,
        }),
      );
      await this.pmWoResultRepo.save(results);
    }

    // FAIL 결과 시 설비 자동 INTERLOCK (일상점검과 동일 정책)
    if (dto.overallResult === 'FAIL' && wo.equipCode) {
      await this.equipMasterRepo.update(
        { equipCode: wo.equipCode, ...this.tenantWhere(company, plant) },
        { status: 'INTERLOCK' },
      );
    }

    if (wo.pmPlanCode) {
      const plan = await this.pmPlanRepo.findOne({
        where: { planCode: wo.pmPlanCode, ...this.tenantWhere(company, plant) },
      });
      if (plan) {
        plan.lastExecutedAt = new Date();
        plan.nextDueAt = this.calculateNextDueAt(
          plan.lastExecutedAt,
          plan.cycleType,
          plan.cycleValue,
          plan.cycleUnit,
        );
        await this.pmPlanRepo.save(plan);
      }
    }

    return wo;
  }

  /** WO 취소 */
  async cancelWorkOrder(workOrderNo: string, company?: string, plant?: string) {
    const wo = await this.pmWorkOrderRepo.findOne({
      where: { workOrderNo, ...this.tenantWhere(company, plant) },
    });
    if (!wo) throw new NotFoundException(`Work Order를 찾을 수 없습니다: ${workOrderNo}`);

    if (wo.status === 'COMPLETED') {
      throw new BadRequestException('완료된 WO는 취소할 수 없습니다.');
    }

    wo.status = 'CANCELLED';
    await this.pmWorkOrderRepo.save(wo);
    return wo;
  }

  /** WO 목록 조회 */
  async findAllWorkOrders(query: PmWorkOrderQueryDto, company?: string, plant?: string) {
    const { page = 1, limit = 50, equipCode, status, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.pmWorkOrderRepo.createQueryBuilder('wo');

    if (company) qb.andWhere('wo.company = :company', { company });
    if (plant) qb.andWhere('wo.plant = :plant', { plant });
    if (equipCode) qb.andWhere('wo.equipCode = :equipCode', { equipCode });
    if (status) qb.andWhere('wo.status = :status', { status });
    if (search) {
      const upper = search.toUpperCase();
      qb.andWhere('wo.workOrderNo LIKE :search', { search: `%${upper}%` });
    }

    const total = await qb.getCount();

    const workOrders = await qb
      .orderBy('wo.scheduledDate', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const equipIds = [...new Set(workOrders.map((wo) => wo.equipCode))];
    const equips = equipIds.length > 0
      ? await this.equipMasterRepo.find({
          where: { equipCode: In(equipIds), ...this.tenantWhere(company, plant) },
          select: ['equipCode', 'equipName', 'lineCode', 'equipType'],
        })
      : [];
    const equipMap = new Map(equips.map((e) => [e.equipCode, e]));

    const data = workOrders.map((wo) => {
      const equip = equipMap.get(wo.equipCode);
      return {
        ...wo,
        equip: {
          equipCode: equip?.equipCode || wo.equipCode,
          equipName: equip?.equipName || '-',
          lineCode: equip?.lineCode || null,
          equipType: equip?.equipType || null,
        },
      };
    });

    return { data, total, page, limit };
  }

  // ─── 캘린더 ────────────────────────────────────────────

  /** 캘린더 월별 요약 (CalendarDaySummary 호환) */
  async getCalendarSummary(
    year: number,
    month: number,
    lineCode?: string,
    equipType?: string,
    company?: string,
    plant?: string,
  ) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const calMonthStr = String(month).padStart(2, '0');
    const calFromStr = `${year}-${calMonthStr}-01`;
    const calToStr = `${year}-${calMonthStr}-${String(daysInMonth).padStart(2, '0')}`;

    const qb = this.pmWorkOrderRepo.createQueryBuilder('wo')
      .leftJoin(
        EquipMaster,
        'equip',
        'wo.equipCode = equip.equipCode AND wo.company = equip.company AND wo.plant = equip.plant',
      )
      .where("wo.scheduledDate >= TO_DATE(:calFromStr, 'YYYY-MM-DD')", { calFromStr })
      .andWhere("wo.scheduledDate < TO_DATE(:calToStr, 'YYYY-MM-DD') + 1", { calToStr });

    if (company) qb.andWhere('wo.company = :company', { company });
    if (plant) qb.andWhere('wo.plant = :plant', { plant });
    if (lineCode) qb.andWhere('equip.lineCode = :lineCode', { lineCode });
    if (equipType) qb.andWhere('equip.equipType = :equipType', { equipType });

    const workOrders = await qb.getMany();

    const woByDate = new Map<string, PmWorkOrder[]>();
    for (const wo of workOrders) {
      const d = new Date(wo.scheduledDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = woByDate.get(key) || [];
      list.push(wo);
      woByDate.set(key, list);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayWos = woByDate.get(dateStr) || [];

      const total = dayWos.length;
      const completed = dayWos.filter((w) => w.status === 'COMPLETED').length;
      const pass = dayWos.filter((w) => w.overallResult === 'PASS').length;
      const fail = dayWos.filter((w) => w.overallResult === 'FAIL').length;

      let status = 'NONE';
      if (total === 0) {
        status = 'NONE';
      } else if (completed >= total && fail === 0) {
        status = 'ALL_PASS';
      } else if (fail > 0) {
        status = 'HAS_FAIL';
      } else if (completed > 0 && completed < total) {
        status = 'IN_PROGRESS';
      } else if (completed === 0) {
        status = dateObj < today ? 'OVERDUE' : 'NOT_STARTED';
      }

      result.push({ date: dateStr, total, completed, pass, fail, status });
    }

    return result;
  }

  /** 캘린더 일별 WO 스케줄 */
  async getDaySchedule(date: string, lineCode?: string, equipType?: string, company?: string, plant?: string) {
    const dayStr = date.substring(0, 10);

    const qb = this.pmWorkOrderRepo.createQueryBuilder('wo')
      .where("wo.scheduledDate >= TO_DATE(:dayStr, 'YYYY-MM-DD')", { dayStr })
      .andWhere("wo.scheduledDate < TO_DATE(:dayStr, 'YYYY-MM-DD') + 1", { dayStr });

    if (company) qb.andWhere('wo.company = :company', { company });
    if (plant) qb.andWhere('wo.plant = :plant', { plant });
    if (lineCode || equipType) {
      qb.leftJoin(
        EquipMaster,
        'equip',
        'wo.equipCode = equip.equipCode AND wo.company = equip.company AND wo.plant = equip.plant',
      );
      if (lineCode) qb.andWhere('equip.lineCode = :lineCode', { lineCode });
      if (equipType) qb.andWhere('equip.equipType = :equipType', { equipType });
    }

    const workOrders = await qb.orderBy('wo.scheduledDate', 'ASC').getMany();

    const equipIds = [...new Set(workOrders.map((wo) => wo.equipCode))];
    const equips = equipIds.length > 0
      ? await this.equipMasterRepo.find({
          where: { equipCode: In(equipIds), ...this.tenantWhere(company, plant) },
          select: ['equipCode', 'equipName', 'lineCode', 'equipType'],
        })
      : [];
    const equipMap = new Map(equips.map((e) => [e.equipCode, e]));

    const woNos = workOrders.map((wo) => wo.workOrderNo);
    const allResults = woNos.length > 0
      ? await this.pmWoResultRepo.find({
          where: { workOrderNo: In(woNos) },
          order: { seq: 'ASC' },
        })
      : [];
    const resultsMap = new Map<string, PmWoResult[]>();
    for (const r of allResults) {
      const list = resultsMap.get(r.workOrderNo) || [];
      list.push(r);
      resultsMap.set(r.workOrderNo, list);
    }

    // PM 계획 + 계획항목 일괄 선조회 (N+1 제거)
    const pmPlanCodes = [...new Set(workOrders.map((wo) => wo.pmPlanCode).filter(Boolean))];
    const allPlans = pmPlanCodes.length > 0
      ? await this.pmPlanRepo.find({
          where: { planCode: In(pmPlanCodes), ...this.tenantWhere(company, plant) },
          select: ['planCode', 'planName'],
        })
      : [];
    const planNameMap = new Map(allPlans.map((p) => [p.planCode, p.planName]));

    const allPlanItems = pmPlanCodes.length > 0
      ? await this.pmPlanItemRepo.find({ where: { pmPlanCode: In(pmPlanCodes), useYn: 'Y' }, order: { seq: 'ASC' } })
      : [];
    const planItemsMap = new Map<string, PmPlanItem[]>();
    for (const item of allPlanItems) {
      const list = planItemsMap.get(item.pmPlanCode) || [];
      list.push(item);
      planItemsMap.set(item.pmPlanCode, list);
    }

    const result = workOrders.map((wo) => {
      const equip = equipMap.get(wo.equipCode);
      const planName = wo.pmPlanCode ? (planNameMap.get(wo.pmPlanCode) || null) : null;
      const planItems = wo.pmPlanCode ? (planItemsMap.get(wo.pmPlanCode) || []) : [];

      return {
        ...wo,
        planName,
        equip: {
          equipCode: equip?.equipCode || '-',
          equipName: equip?.equipName || '-',
          lineCode: equip?.lineCode || null,
          equipType: equip?.equipType || null,
        },
        planItems,
        results: resultsMap.get(wo.workOrderNo) || [],
      };
    });

    return result;
  }

  // ─── 내부 헬퍼 ────────────────────────────────────────

  /** nextDueAt 계산 */
  private calculateNextDueAt(
    baseDate: Date,
    cycleType: string,
    cycleValue: number,
    cycleUnit: string,
  ): Date {
    const d = new Date(baseDate);

    switch (cycleType) {
      case 'MONTHLY':
        d.setMonth(d.getMonth() + cycleValue);
        break;
      case 'QUARTERLY':
        d.setMonth(d.getMonth() + 3);
        break;
      case 'SEMI_ANNUAL':
        d.setMonth(d.getMonth() + 6);
        break;
      case 'ANNUAL':
        d.setFullYear(d.getFullYear() + 1);
        break;
      case 'CUSTOM':
        switch (cycleUnit) {
          case 'DAY':
            d.setDate(d.getDate() + cycleValue);
            break;
          case 'WEEK':
            d.setDate(d.getDate() + cycleValue * 7);
            break;
          case 'MONTH':
            d.setMonth(d.getMonth() + cycleValue);
            break;
          case 'YEAR':
            d.setFullYear(d.getFullYear() + cycleValue);
            break;
          default:
            d.setMonth(d.getMonth() + cycleValue);
        }
        break;
      default:
        d.setMonth(d.getMonth() + 1);
    }

    return d;
  }

  /** WO 번호 채번: PM-YYYYMMDD-NNN */
  private async generateWoNumber(dateStr: string): Promise<string> {
    const cleanDate = dateStr.replace(/-/g, '');
    const prefix = `PM-${cleanDate}-`;

    const lastWo = await this.pmWorkOrderRepo
      .createQueryBuilder('wo')
      .where('wo.workOrderNo LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('wo.workOrderNo', 'DESC')
      .getOne();

    let seq = 1;
    if (lastWo) {
      const lastSeq = parseInt(lastWo.workOrderNo.substring(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  /** 날짜 포맷 (YYYYMMDD) */
  private formatDate(date: Date): string {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }
}
