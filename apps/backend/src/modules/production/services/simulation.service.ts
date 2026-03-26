/**
 * @file src/modules/production/services/simulation.service.ts
 * @description 생산계획 시뮬레이션 서비스 - 납기/CAPA/월력 기반 일자별 스케줄 시뮬레이션
 *
 * 초보자 가이드:
 * 1. **목적**: 월간 생산계획을 작업일에 배분하여 납기 준수 여부를 사전 검증한다.
 * 2. **알고리즘 흐름**:
 *    - 해당 월 생산계획 조회 (DRAFT + CONFIRMED)
 *    - 월력(WorkCalendar)에서 작업일 목록 추출
 *    - 품목별 병목 CAPA 조회 (ProcessCapa의 MIN(dailyCapa))
 *    - 수주(CustomerOrder)에서 납기일 매칭
 *    - 납기순 + 우선순위순으로 작업일에 수량 배분
 * 3. **CAPA 규칙**:
 *    - 같은 품목은 같은 날 CAPA를 공유 (한 설비가 하나씩)
 *    - 다른 품목은 같은 날 동시 가능 (다른 설비)
 *    - 하루 CAPA 초과 시 다음 작업일로 이월
 * 4. **파일 구조**: 데이터 로딩은 SimulationDataService에 위임
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProdPlan } from '../../../entities/prod-plan.entity';
import { SimulationHeader, SimulationPlan, SimulationSchedule } from '../../../entities/simulation-result.entity';
import { SimulationDataService, ProcessCapaInfo } from './simulation-data.service';
import {
  buildSchedule,
  buildSummary,
  calcDaysDiff,
  emptyResult,
  sortPlansByDueDate,
  sortByMinSetup,
} from './simulation-helper';
import {
  SimulationResult,
  SimPlanResult,
  SimDayItem,
} from '../dto/simulation.dto';

/** re-export for consumers */
export type { SimulationResult } from '../dto/simulation.dto';

/** 시뮬레이션 옵션 */
export interface SimulationOptions {
  shiftCount: number;   // 교대 수 (1/2/3)
  includeOt: boolean;   // 잔업 포함
  applySetup: boolean;  // 셋업시간 반영
  deductStock: boolean; // 재고 차감
}

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectRepository(ProdPlan)
    private readonly planRepo: Repository<ProdPlan>,
    @InjectRepository(SimulationHeader)
    private readonly headerRepo: Repository<SimulationHeader>,
    @InjectRepository(SimulationPlan)
    private readonly simPlanRepo: Repository<SimulationPlan>,
    @InjectRepository(SimulationSchedule)
    private readonly simScheduleRepo: Repository<SimulationSchedule>,
    private readonly dataService: SimulationDataService,
  ) {}

  /**
   * 생산계획 시뮬레이션 실행
   * @param month 계획월 (YYYY-MM)
   * @param company 회사코드
   * @param plant 공장코드
   */
  async simulate(
    month: string,
    company: string,
    plant: string,
    strategy: 'DUE_DATE' | 'MIN_SETUP' = 'DUE_DATE',
    planOrder?: string[],
    options: SimulationOptions = { shiftCount: 1, includeOt: false, applySetup: true, deductStock: false },
  ): Promise<SimulationResult> {
    // 1. 해당 월 생산계획 조회
    const plans = await this.planRepo.find({
      where: { planMonth: month, company, plant },
      relations: ['part'],
      order: { priority: 'ASC' },
    });

    if (plans.length === 0) {
      return emptyResult();
    }

    // 2. 작업일 목록 조회
    const workDays = await this.dataService.loadWorkDays(month, company, plant);
    if (workDays.length === 0) {
      this.logger.warn(`월력에 작업일이 없습니다: ${month}`);
      return emptyResult();
    }

    // 3. 품목별 CAPA 조회 (병목 + 전체 공정)
    const itemCodes = [...new Set(plans.map((p) => p.itemCode))];
    const { capaMap: bottleneckMap, processMap: bottleneckProcessMap } =
      await this.dataService.loadBottleneckCapa(itemCodes, company, plant);
    const allProcessCapa = await this.dataService.loadAllProcessCapa(itemCodes, company, plant);

    // 4. 수주에서 납기일 조회
    const dueDateMap = await this.dataService.loadDueDates(
      plans,
      month,
      company,
      plant,
    );

    // 5. 고객명 조회
    const customerNameMap = await this.dataService.loadCustomerNames(
      plans,
      company,
      plant,
    );

    // 6. 정렬: 사용자 지정 순서 > 전략
    let sortedPlans: ProdPlan[];
    if (planOrder && planOrder.length > 0) {
      const orderMap = new Map(planOrder.map((no, idx) => [no, idx]));
      sortedPlans = [...plans].sort((a, b) =>
        (orderMap.get(a.planNo) ?? 999) - (orderMap.get(b.planNo) ?? 999),
      );
    } else {
      sortedPlans = strategy === 'MIN_SETUP'
        ? sortByMinSetup(plans, dueDateMap)
        : sortPlansByDueDate(plans, dueDateMap);
    }

    // 7. 스케줄링 실행 (전체 공정 순서 기반)
    const result = this.runScheduling(
      sortedPlans,
      workDays,
      bottleneckMap,
      bottleneckProcessMap,
      allProcessCapa,
      dueDateMap,
      customerNameMap,
      options,
    );

    return result;
  }

  /** 마지막 시뮬레이션 결과 조회 (정규화 테이블에서 복원) */
  async getLatest(
    month: string,
    company: string,
    plant: string,
  ): Promise<SimulationResult | null> {
    const header = await this.headerRepo.findOne({
      where: { simMonth: month, company, plant },
      order: { createdAt: 'DESC' },
    });
    if (!header) return null;

    const planRows = await this.simPlanRepo.find({
      where: { simId: header.simId },
    });
    const plans: SimPlanResult[] = planRows.map(r => ({
      planNo: r.planNo, itemCode: r.itemCode, itemName: r.itemName,
      itemType: r.itemType, customer: r.customer, customerName: r.customerName,
      planQty: r.planQty, dueDate: r.dueDate, priority: r.priority,
      startDate: r.startDate, endDate: r.endDate,
      onTime: r.onTime === 'Y', delayDays: r.delayDays,
      requiredDays: r.requiredDays, bottleneckProcess: r.bottleneckProcess,
      dailyCapa: r.dailyCapa,
    }));

    // 저장된 결과에는 상세 스케줄 없음 — 다시 시뮬레이션 실행하면 생성됨
    return {
      plans, schedule: [],
      summary: {
        totalPlans: header.totalPlans, onTimeCount: header.onTimeCount,
        delayCount: header.delayCount, totalQty: header.totalQty,
        workDays: header.workDays, utilizationRate: header.utilizationRate,
        requiredHours: header.requiredHours, availableHours: header.availableHours,
      },
    };
  }

  /** 시뮬레이션 결과를 정규화 테이블에 저장 */
  async saveResult(
    month: string,
    strategy: string,
    result: SimulationResult,
    company: string,
    plant: string,
    options?: SimulationOptions,
  ): Promise<void> {
    const now = new Date();
    const simId = `SIM-${month.replace('-', '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const s = result.summary;

    // 1. 헤더 저장
    await this.headerRepo.save(this.headerRepo.create({
      simId, simMonth: month, strategy,
      shiftCount: options?.shiftCount ?? 1,
      includeOt: options?.includeOt ? 'Y' : 'N',
      applySetup: options?.applySetup !== false ? 'Y' : 'N',
      deductStock: options?.deductStock ? 'Y' : 'N',
      totalPlans: s.totalPlans, onTimeCount: s.onTimeCount, delayCount: s.delayCount,
      totalQty: s.totalQty, workDays: s.workDays, utilizationRate: s.utilizationRate,
      requiredHours: s.requiredHours, availableHours: s.availableHours,
      company, plant,
    }));

    // 2. 계획 일괄 저장
    const planEntities = result.plans.map(p => this.simPlanRepo.create({
      simId, planNo: p.planNo, itemCode: p.itemCode, itemName: p.itemName,
      itemType: p.itemType, customer: p.customer, customerName: p.customerName,
      planQty: p.planQty, dueDate: p.dueDate, priority: p.priority,
      startDate: p.startDate, endDate: p.endDate,
      onTime: p.onTime ? 'Y' : 'N', delayDays: p.delayDays,
      requiredDays: p.requiredDays, bottleneckProcess: p.bottleneckProcess,
      dailyCapa: p.dailyCapa,
    }));
    await this.simPlanRepo.insert(planEntities);

    // 3. 스케줄 저장 (계획×공정별 시작/종료/수량 집계)
    const procSummary = new Map<string, { processName: string; startDate: string; endDate: string; totalQty: number }>();
    for (const day of result.schedule) {
      for (const item of day.items) {
        const key = `${item.planNo}|${item.processCode}`;
        const existing = procSummary.get(key);
        if (!existing) {
          procSummary.set(key, { processName: item.processName, startDate: day.date, endDate: day.date, totalQty: item.qty });
        } else {
          existing.endDate = day.date;
          existing.totalQty += item.qty;
        }
      }
    }
    const schedEntities = Array.from(procSummary.entries()).map(([key, val]) => {
      const [planNo, processCode] = key.split('|');
      return this.simScheduleRepo.create({
        simId, planNo, processCode,
        processName: val.processName, startDate: val.startDate,
        endDate: val.endDate, totalQty: val.totalQty,
      });
    });
    if (schedEntities.length > 0) {
      await this.simScheduleRepo.insert(schedEntities);
    }
  }

  /**
   * 역산 스케줄링 + 정방향 배분 알고리즘.
   * 1) 역산: 납기에서 마지막 공정 → 첫 공정 순으로 이상적 시작일 계산
   * 2) 정산: 첫 공정 → 마지막 공정 순으로 실제 CAPA 소진하며 배분
   * 3) 셋업: 같은 공정에서 품목 전환 시 setupTime/480 × dailyCapa만큼 CAPA 차감
   */
  private runScheduling(
    plans: ProdPlan[],
    workDays: string[],
    bottleneckMap: Map<string, number>,
    bottleneckProcessMap: Map<string, string>,
    allProcessCapa: Map<string, ProcessCapaInfo[]>,
    dueDateMap: Map<string, string | null>,
    customerNameMap: Map<string, string>,
    options: SimulationOptions,
  ): SimulationResult {
    // 교대/잔업에 따른 CAPA 배율 계산
    const OT_MINUTES = 180;
    const BASE_MINUTES = 480;
    const shiftMultiplier = options.shiftCount;
    const otMultiplier = options.includeOt ? (BASE_MINUTES + OT_MINUTES) / BASE_MINUTES : 1;
    const capaMultiplier = shiftMultiplier * otMultiplier;

    /** day → processCode → usedQty */
    const dailyProcessUsed = new Map<string, Map<string, number>>();
    /** day → processCode → 마지막 품목코드 (셋업 판정용) */
    const dailyProcessLastItem = new Map<string, Map<string, string>>();
    const dayScheduleMap = new Map<string, SimDayItem[]>();

    for (const day of workDays) {
      dailyProcessUsed.set(day, new Map());
      dailyProcessLastItem.set(day, new Map());
      dayScheduleMap.set(day, []);
    }

    const planCumQty = new Map<string, number>();
    const planResults: SimPlanResult[] = [];
    const MINUTES_PER_DAY = BASE_MINUTES * shiftMultiplier + (options.includeOt ? OT_MINUTES : 0);

    for (const plan of plans) {
      const processes = allProcessCapa.get(plan.itemCode) ?? [];
      let planStartDate: string | null = null;
      let planEndDate: string | null = null;

      // ── 역산: 납기에서 각 공정별 이상적 시작 인덱스 계산 ──
      const dueDate = dueDateMap.get(plan.planNo) ?? null;
      const dueDateIdx = dueDate
        ? workDays.findIndex((d) => d >= dueDate)
        : workDays.length - 1;
      const effectiveDueIdx = dueDateIdx >= 0 ? dueDateIdx : workDays.length - 1;

      let idealStartIdx = effectiveDueIdx;
      const processIdealStart = new Map<string, number>();
      for (let pi = processes.length - 1; pi >= 0; pi--) {
        const p = processes[pi];
        const daysNeeded = Math.ceil(plan.planQty / Math.floor(p.dailyCapa * capaMultiplier));
        idealStartIdx = Math.max(0, idealStartIdx - daysNeeded);
        processIdealStart.set(p.processCode, idealStartIdx);
      }

      // ── 정산: 역산 결과 기반으로 정방향 배분 ──
      let prevProcessEndIdx = idealStartIdx;

      for (const proc of processes) {
        let remainQty = plan.planQty;
        const idealStart = processIdealStart.get(proc.processCode) ?? 0;
        const startIdx = Math.max(prevProcessEndIdx, idealStart);

        for (let dayIdx = startIdx; dayIdx < workDays.length; dayIdx++) {
          if (remainQty <= 0) break;
          const day = workDays[dayIdx];

          const usedMap = dailyProcessUsed.get(day)!;
          const lastItemMap = dailyProcessLastItem.get(day)!;
          const usedToday = usedMap.get(proc.processCode) ?? 0;
          const adjustedCapa = Math.floor(proc.dailyCapa * capaMultiplier);
          let available = adjustedCapa - usedToday;

          // 셋업시간 반영 (옵션)
          if (options.applySetup) {
            const lastItem = lastItemMap.get(proc.processCode);
            if (lastItem && lastItem !== plan.itemCode && proc.setupTime > 0) {
              const setupCost = Math.ceil(
                (proc.setupTime / MINUTES_PER_DAY) * adjustedCapa,
              );
              available -= setupCost;
            }
          }

          if (available <= 0) continue;

          const todayQty = Math.min(remainQty, available);
          usedMap.set(proc.processCode, usedToday + todayQty);
          lastItemMap.set(proc.processCode, plan.itemCode);
          remainQty -= todayQty;

          // 모든 공정을 스케줄에 기록
          const cumKey = `${plan.planNo}::${proc.processCode}`;
          const prevCum = planCumQty.get(cumKey) ?? 0;
          const cum = prevCum + todayQty;
          planCumQty.set(cumKey, cum);
          dayScheduleMap.get(day)!.push({
            planNo: plan.planNo,
            itemCode: plan.itemCode,
            processCode: proc.processCode,
            processName: proc.processName,
            qty: todayQty,
            cumQty: cum,
          });

          if (!planStartDate) planStartDate = day;
          planEndDate = day;
          prevProcessEndIdx = dayIdx;
        }
      }

      const onTime = dueDate && planEndDate ? planEndDate <= dueDate : true;
      const delayDays =
        !onTime && dueDate && planEndDate
          ? calcDaysDiff(dueDate, planEndDate)
          : 0;

      const bottleneckCapa = bottleneckMap.get(plan.itemCode) ?? 9999;
      let totalRequiredDays = 0;
      for (const proc of processes) {
        totalRequiredDays += Math.ceil(plan.planQty / proc.dailyCapa);
      }

      planResults.push({
        planNo: plan.planNo,
        itemCode: plan.itemCode,
        itemName: plan.part?.itemName ?? plan.itemCode,
        itemType: plan.itemType ?? 'FG',
        customer: plan.customer ?? '',
        customerName: customerNameMap.get(plan.customer ?? '') ?? '',
        planQty: plan.planQty,
        dueDate,
        priority: plan.priority,
        startDate: planStartDate ?? '',
        endDate: planEndDate ?? '',
        onTime,
        delayDays,
        requiredDays: totalRequiredDays,
        bottleneckProcess: bottleneckProcessMap.get(plan.itemCode) ?? '-',
        dailyCapa: bottleneckCapa,
      });
    }

    const schedule = buildSchedule(workDays, dayScheduleMap);
    const summary = buildSummary(planResults, workDays, schedule, bottleneckMap);

    return { plans: planResults, schedule, summary };
  }

}
