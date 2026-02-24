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
import { Repository, Between, In } from 'typeorm';
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

  // ─── PM Plan CRUD ────────────────────────────────────────

  /** PM 계획 목록 조회 */
  async findAllPlans(query: PmPlanQueryDto) {
    const { page = 1, limit = 50, equipId, pmType, search, dueDateFrom, dueDateTo } = query;
    const skip = (page - 1) * limit;

    const qb = this.pmPlanRepo.createQueryBuilder('plan');

    if (equipId) qb.andWhere('plan.equipId = :equipId', { equipId });
    if (pmType) qb.andWhere('plan.pmType = :pmType', { pmType });
    if (search) {
      qb.andWhere(
        '(LOWER(plan.planCode) LIKE LOWER(:search) OR LOWER(plan.planName) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }
    if (dueDateFrom) {
      qb.andWhere('plan.nextDueAt >= :dueDateFrom', { dueDateFrom: new Date(dueDateFrom) });
    }
    if (dueDateTo) {
      const toDate = new Date(dueDateTo);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('plan.nextDueAt <= :dueDateTo', { dueDateTo: toDate });
    }

    const total = await qb.getCount();

    const plans = await qb
      .orderBy('plan.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const planIds = plans.map((p) => p.id);
    const equipIds = [...new Set(plans.map((p) => p.equipId))];

    const equips = equipIds.length > 0
      ? await this.equipMasterRepo.find({
          where: { id: In(equipIds) },
          select: ['id', 'equipCode', 'equipName', 'lineCode', 'equipType'],
        })
      : [];
    const equipMap = new Map(equips.map((e) => [e.id, e]));

    // 계획별 항목 수 조회
    let itemCountMap = new Map<string, number>();
    if (planIds.length > 0) {
      const itemCounts = await this.pmPlanItemRepo
        .createQueryBuilder('item')
        .select('item.pmPlanId', 'pmPlanId')
        .addSelect('COUNT(*)', 'cnt')
        .where('item.pmPlanId IN (:...planIds)', { planIds })
        .andWhere('item.useYn = :useYn', { useYn: 'Y' })
        .groupBy('item.pmPlanId')
        .getRawMany();
      itemCountMap = new Map(itemCounts.map((r: any) => [r.pmPlanId, parseInt(r.cnt, 10)]));
    }

    const data = plans.map((plan) => {
      const equip = equipMap.get(plan.equipId);
      return {
        ...plan,
        itemCount: itemCountMap.get(plan.id) || 0,
        equip: {
          id: equip?.id || plan.equipId,
          equipCode: equip?.equipCode || '-',
          equipName: equip?.equipName || '-',
          lineCode: equip?.lineCode || null,
          equipType: equip?.equipType || null,
        },
      };
    });

    return { data, total, page, limit };
  }

  /** PM 계획 상세 조회 (items 포함) */
  async findPlanById(id: string) {
    const plan = await this.pmPlanRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!plan) throw new NotFoundException(`PM 계획을 찾을 수 없습니다: ${id}`);

    const equip = await this.equipMasterRepo.findOne({
      where: { id: plan.equipId },
      select: ['id', 'equipCode', 'equipName', 'lineCode', 'equipType'],
    });

    if (plan.items) {
      plan.items.sort((a, b) => a.seq - b.seq);
    }

    return { ...plan, equip: equip || null };
  }

  /** PM 계획 생성 */
  async createPlan(dto: CreatePmPlanDto) {
    const equip = await this.equipMasterRepo.findOne({
      where: { id: dto.equipId },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipId}`);

    const nextDueAt = this.calculateNextDueAt(
      new Date(),
      dto.cycleType || 'MONTHLY',
      dto.cycleValue || 1,
      dto.cycleUnit || 'MONTH',
    );

    const plan = this.pmPlanRepo.create({
      equipId: dto.equipId,
      planCode: dto.planCode,
      planName: dto.planName,
      pmType: dto.pmType || 'TIME_BASED',
      cycleType: dto.cycleType || 'MONTHLY',
      cycleValue: dto.cycleValue || 1,
      cycleUnit: dto.cycleUnit || 'MONTH',
      seasonMonth: dto.seasonMonth ?? null,
      estimatedTime: dto.estimatedTime ?? null,
      description: dto.description ?? null,
      nextDueAt,
    });

    const saved = await this.pmPlanRepo.save(plan);

    if (dto.items?.length) {
      const items = dto.items.map((item) =>
        this.pmPlanItemRepo.create({
          pmPlanId: saved.id,
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

    return this.findPlanById(saved.id);
  }

  /** PM 계획 수정 */
  async updatePlan(id: string, dto: UpdatePmPlanDto) {
    const plan = await this.pmPlanRepo.findOne({
      where: { id },
    });
    if (!plan) throw new NotFoundException(`PM 계획을 찾을 수 없습니다: ${id}`);

    if (dto.equipId !== undefined) plan.equipId = dto.equipId;
    if (dto.planCode !== undefined) plan.planCode = dto.planCode;
    if (dto.planName !== undefined) plan.planName = dto.planName;
    if (dto.pmType !== undefined) plan.pmType = dto.pmType;
    if (dto.cycleType !== undefined) plan.cycleType = dto.cycleType;
    if (dto.cycleValue !== undefined) plan.cycleValue = dto.cycleValue;
    if (dto.cycleUnit !== undefined) plan.cycleUnit = dto.cycleUnit;
    if (dto.seasonMonth !== undefined) plan.seasonMonth = dto.seasonMonth;
    if (dto.estimatedTime !== undefined) plan.estimatedTime = dto.estimatedTime;
    if (dto.description !== undefined) plan.description = dto.description;

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
      await this.pmPlanItemRepo.delete({ pmPlanId: id });
      if (dto.items.length > 0) {
        const items = dto.items.map((item) =>
          this.pmPlanItemRepo.create({
            pmPlanId: id,
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

    return this.findPlanById(id);
  }

  /** PM 계획 삭제 (소프트) */
  async deletePlan(id: string) {
    const plan = await this.pmPlanRepo.findOne({
      where: { id },
    });
    if (!plan) throw new NotFoundException(`PM 계획을 찾을 수 없습니다: ${id}`);
    await this.pmPlanRepo.delete(id);
    return { id, deleted: true };
  }

  // ─── Work Order 관리 ────────────────────────────────────

  /** WO 일괄 생성 (해당 월에 nextDueAt이 도래하는 계획들) */
  async generateWorkOrders(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const plans = await this.pmPlanRepo.find({
      where: {
        useYn: 'Y',
        nextDueAt: Between(startDate, endDate),
      },
    });

    let created = 0;
    let skipped = 0;

    for (const plan of plans) {
      const scheduledDate = plan.nextDueAt || startDate;
      const dateStr = this.formatDate(scheduledDate);

      const existing = await this.pmWorkOrderRepo.findOne({
        where: {
          pmPlanId: plan.id,
          scheduledDate: scheduledDate,
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const workOrderNo = await this.generateWoNumber(dateStr);

      const wo = this.pmWorkOrderRepo.create({
        workOrderNo,
        pmPlanId: plan.id,
        equipId: plan.equipId,
        woType: 'PLANNED',
        scheduledDate,
        dueDate: scheduledDate,
        status: 'PLANNED',
        priority: 'MEDIUM',
        company: plan.company,
        plant: plan.plant,
      });

      await this.pmWorkOrderRepo.save(wo);
      created++;
    }

    return { created, skipped, total: plans.length };
  }

  /** WO 수동 생성 */
  async createWorkOrder(dto: CreatePmWorkOrderDto) {
    const equip = await this.equipMasterRepo.findOne({
      where: { id: dto.equipId },
    });
    if (!equip) throw new NotFoundException(`설비를 찾을 수 없습니다: ${dto.equipId}`);

    const dateStr = dto.scheduledDate.substring(0, 10).replace(/-/g, '');
    const workOrderNo = await this.generateWoNumber(dateStr);

    const wo = this.pmWorkOrderRepo.create({
      workOrderNo,
      pmPlanId: dto.pmPlanId || null,
      equipId: dto.equipId,
      woType: dto.woType || 'PLANNED',
      scheduledDate: new Date(dto.scheduledDate),
      dueDate: new Date(dto.scheduledDate),
      status: 'PLANNED',
      priority: dto.priority || 'MEDIUM',
      assignedWorkerId: dto.assignedWorkerId || null,
    });

    const saved = await this.pmWorkOrderRepo.save(wo);
    return saved;
  }

  /** WO 실행 */
  async executeWorkOrder(id: string, dto: ExecutePmWorkOrderDto) {
    const wo = await this.pmWorkOrderRepo.findOne({
      where: { id },
    });
    if (!wo) throw new NotFoundException(`Work Order를 찾을 수 없습니다: ${id}`);

    if (wo.status === 'COMPLETED' || wo.status === 'CANCELLED') {
      throw new BadRequestException(`이미 ${wo.status} 상태입니다.`);
    }

    wo.status = 'COMPLETED';
    wo.completedAt = new Date();
    wo.overallResult = dto.overallResult;
    wo.remark = dto.remark || null;
    if (dto.assignedWorkerId) wo.assignedWorkerId = dto.assignedWorkerId;
    if (!wo.startedAt) wo.startedAt = new Date();

    await this.pmWorkOrderRepo.save(wo);

    if (dto.items?.length) {
      const results = dto.items.map((item) =>
        this.pmWoResultRepo.create({
          workOrderId: wo.id,
          pmPlanItemId: item.itemId || null,
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

    if (wo.pmPlanId) {
      const plan = await this.pmPlanRepo.findOne({
        where: { id: wo.pmPlanId },
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
  async cancelWorkOrder(id: string) {
    const wo = await this.pmWorkOrderRepo.findOne({
      where: { id },
    });
    if (!wo) throw new NotFoundException(`Work Order를 찾을 수 없습니다: ${id}`);

    if (wo.status === 'COMPLETED') {
      throw new BadRequestException('완료된 WO는 취소할 수 없습니다.');
    }

    wo.status = 'CANCELLED';
    await this.pmWorkOrderRepo.save(wo);
    return wo;
  }

  /** WO 목록 조회 */
  async findAllWorkOrders(query: PmWorkOrderQueryDto) {
    const { page = 1, limit = 50, equipId, status, search } = query;
    const skip = (page - 1) * limit;

    const qb = this.pmWorkOrderRepo.createQueryBuilder('wo');

    if (equipId) qb.andWhere('wo.equipId = :equipId', { equipId });
    if (status) qb.andWhere('wo.status = :status', { status });
    if (search) {
      qb.andWhere('LOWER(wo.workOrderNo) LIKE LOWER(:search)', { search: `%${search}%` });
    }

    const total = await qb.getCount();

    const workOrders = await qb
      .orderBy('wo.scheduledDate', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

    const equipIds = [...new Set(workOrders.map((wo) => wo.equipId))];
    const equips = equipIds.length > 0
      ? await this.equipMasterRepo.find({
          where: { id: In(equipIds) },
          select: ['id', 'equipCode', 'equipName', 'lineCode', 'equipType'],
        })
      : [];
    const equipMap = new Map(equips.map((e) => [e.id, e]));

    const data = workOrders.map((wo) => {
      const equip = equipMap.get(wo.equipId);
      return {
        ...wo,
        equip: {
          id: equip?.id || wo.equipId,
          equipCode: equip?.equipCode || '-',
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
  ) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month - 1, daysInMonth, 23, 59, 59);

    const qb = this.pmWorkOrderRepo.createQueryBuilder('wo')
      .leftJoin(EquipMaster, 'equip', 'wo.equipId = equip.id')
      .where('wo.scheduledDate BETWEEN :startDate AND :endDate', { startDate, endDate });

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
  async getDaySchedule(date: string, lineCode?: string, equipType?: string) {
    const dateObj = new Date(date);
    const dayStart = new Date(dateObj);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dateObj);
    dayEnd.setHours(23, 59, 59, 999);

    const qb = this.pmWorkOrderRepo.createQueryBuilder('wo')
      .where('wo.scheduledDate BETWEEN :dayStart AND :dayEnd', { dayStart, dayEnd });

    if (lineCode || equipType) {
      qb.leftJoin(EquipMaster, 'equip', 'wo.equipId = equip.id');
      if (lineCode) qb.andWhere('equip.lineCode = :lineCode', { lineCode });
      if (equipType) qb.andWhere('equip.equipType = :equipType', { equipType });
    }

    const workOrders = await qb.orderBy('wo.scheduledDate', 'ASC').getMany();

    const equipIds = [...new Set(workOrders.map((wo) => wo.equipId))];
    const equips = equipIds.length > 0
      ? await this.equipMasterRepo.find({
          where: { id: In(equipIds) },
          select: ['id', 'equipCode', 'equipName', 'lineCode', 'equipType'],
        })
      : [];
    const equipMap = new Map(equips.map((e) => [e.id, e]));

    const woIds = workOrders.map((wo) => wo.id);
    const allResults = woIds.length > 0
      ? await this.pmWoResultRepo.find({
          where: { workOrderId: In(woIds) },
          order: { seq: 'ASC' },
        })
      : [];
    const resultsMap = new Map<string, PmWoResult[]>();
    for (const r of allResults) {
      const list = resultsMap.get(r.workOrderId) || [];
      list.push(r);
      resultsMap.set(r.workOrderId, list);
    }

    const result = await Promise.all(
      workOrders.map(async (wo) => {
        const equip = equipMap.get(wo.equipId);

        let planItems: PmPlanItem[] = [];
        let planName: string | null = null;
        if (wo.pmPlanId) {
          const plan = await this.pmPlanRepo.findOne({
            where: { id: wo.pmPlanId },
            select: ['id', 'planName'],
          });
          planName = plan?.planName || null;
          const rawItems = await this.pmPlanItemRepo.find({
            where: { pmPlanId: wo.pmPlanId, useYn: 'Y' },
            order: { seq: 'ASC' },
          });
          planItems = rawItems;
        }

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
          results: resultsMap.get(wo.id) || [],
        };
      }),
    );

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
