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
import { SimulationResultEntity } from '../../../entities/simulation-result.entity';
import { SimulationDataService } from './simulation-data.service';
import {
  SimulationResult,
  SimPlanResult,
  SimDayItem,
  SimDaySchedule,
  SimSummary,
} from '../dto/simulation.dto';

/** re-export for consumers */
export type { SimulationResult } from '../dto/simulation.dto';

@Injectable()
export class SimulationService {
  private readonly logger = new Logger(SimulationService.name);

  constructor(
    @InjectRepository(ProdPlan)
    private readonly planRepo: Repository<ProdPlan>,
    @InjectRepository(SimulationResultEntity)
    private readonly simResultRepo: Repository<SimulationResultEntity>,
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
  ): Promise<SimulationResult> {
    // 1. 해당 월 생산계획 조회
    const plans = await this.planRepo.find({
      where: { planMonth: month, company, plant },
      relations: ['part'],
      order: { priority: 'ASC' },
    });

    if (plans.length === 0) {
      return this.emptyResult();
    }

    // 2. 작업일 목록 조회
    const workDays = await this.dataService.loadWorkDays(month, company, plant);
    if (workDays.length === 0) {
      this.logger.warn(`월력에 작업일이 없습니다: ${month}`);
      return this.emptyResult();
    }

    // 3. 품목별 병목 CAPA + 공정명 조회
    const itemCodes = [...new Set(plans.map((p) => p.itemCode))];
    const { capaMap: bottleneckMap, processMap: bottleneckProcessMap } =
      await this.dataService.loadBottleneckCapa(itemCodes, company, plant);

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
        ? this.sortByMinSetup(plans, dueDateMap)
        : this.sortPlansByDueDate(plans, dueDateMap);
    }

    // 7. 스케줄링 실행
    const result = this.runScheduling(
      sortedPlans,
      workDays,
      bottleneckMap,
      bottleneckProcessMap,
      dueDateMap,
      customerNameMap,
    );

    return result;
  }

  /** 마지막 시뮬레이션 결과 조회 */
  async getLatest(
    month: string,
    company: string,
    plant: string,
  ): Promise<SimulationResult | null> {
    const row = await this.simResultRepo.findOne({
      where: { simMonth: month, company, plant },
      order: { createdAt: 'DESC' },
    });
    if (!row) return null;
    try { return JSON.parse(row.resultJson) as SimulationResult; }
    catch { return null; }
  }

  /** 시뮬레이션 결과를 DB에 저장 */
  async saveResult(
    month: string,
    strategy: string,
    result: SimulationResult,
    company: string,
    plant: string,
  ): Promise<void> {
    const now = new Date();
    const simId = `SIM-${month.replace('-', '')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const entity = this.simResultRepo.create({
      simId,
      simMonth: month,
      strategy,
      resultJson: JSON.stringify(result),
      company,
      plant,
    });
    await this.simResultRepo.save(entity);
  }

  /**
   * 납기순 -> 우선순위순으로 계획을 정렬한다.
   * 납기가 없는 계획은 뒤로 밀린다.
   */
  private sortPlansByDueDate(
    plans: ProdPlan[],
    dueDateMap: Map<string, string | null>,
  ): ProdPlan[] {
    return [...plans].sort((a, b) => {
      const da = dueDateMap.get(a.planNo);
      const db = dueDateMap.get(b.planNo);

      if (!da && db) return 1;
      if (da && !db) return -1;
      if (da && db && da !== db) return da.localeCompare(db);

      return (a.priority ?? 5) - (b.priority ?? 5);
    });
  }

  /**
   * 모델체인지 최소화 정렬: 같은 품목끼리 몰아서 배치한다.
   * 품목 그룹 내에서는 납기순 → 우선순위순.
   */
  private sortByMinSetup(
    plans: ProdPlan[],
    dueDateMap: Map<string, string | null>,
  ): ProdPlan[] {
    return [...plans].sort((a, b) => {
      // 1차: 품목코드 그룹핑
      if (a.itemCode !== b.itemCode) return a.itemCode.localeCompare(b.itemCode);
      // 2차: 같은 품목 내에서 납기순
      const da = dueDateMap.get(a.planNo);
      const db = dueDateMap.get(b.planNo);
      if (!da && db) return 1;
      if (da && !db) return -1;
      if (da && db && da !== db) return da.localeCompare(db);
      // 3차: 우선순위
      return (a.priority ?? 5) - (b.priority ?? 5);
    });
  }

  /**
   * 스케줄링 실행: 각 계획의 수량을 작업일에 배분한다.
   */
  private runScheduling(
    plans: ProdPlan[],
    workDays: string[],
    bottleneckMap: Map<string, number>,
    bottleneckProcessMap: Map<string, string>,
    dueDateMap: Map<string, string | null>,
    customerNameMap: Map<string, string>,
  ): SimulationResult {
    const dailyUsed = new Map<string, Map<string, number>>();
    const dayScheduleMap = new Map<string, SimDayItem[]>();
    for (const day of workDays) {
      dailyUsed.set(day, new Map());
      dayScheduleMap.set(day, []);
    }

    const planCumQty = new Map<string, number>();
    const planResults: SimPlanResult[] = [];

    for (const plan of plans) {
      let remainQty = plan.planQty;
      const itemCapa = bottleneckMap.get(plan.itemCode) ?? 9999;
      let startDate: string | null = null;
      let endDate: string | null = null;
      planCumQty.set(plan.planNo, 0);

      for (const day of workDays) {
        if (remainQty <= 0) break;

        const usedMap = dailyUsed.get(day)!;
        const usedToday = usedMap.get(plan.itemCode) ?? 0;
        const availableToday = Math.max(0, itemCapa - usedToday);
        if (availableToday <= 0) continue;

        const todayQty = Math.min(remainQty, availableToday);
        usedMap.set(plan.itemCode, usedToday + todayQty);
        remainQty -= todayQty;

        const cum = (planCumQty.get(plan.planNo) ?? 0) + todayQty;
        planCumQty.set(plan.planNo, cum);

        dayScheduleMap.get(day)!.push({
          planNo: plan.planNo,
          itemCode: plan.itemCode,
          qty: todayQty,
          cumQty: cum,
        });

        if (!startDate) startDate = day;
        endDate = day;
      }

      const dueDate = dueDateMap.get(plan.planNo) ?? null;
      const onTime = dueDate && endDate ? endDate <= dueDate : true;
      const delayDays =
        !onTime && dueDate && endDate
          ? this.calcDaysDiff(dueDate, endDate)
          : 0;

      // 소요일수 = 계획수량 / 일일CAPA (올림)
      const requiredDays = Math.ceil(plan.planQty / itemCapa);

      planResults.push({
        planNo: plan.planNo,
        itemCode: plan.itemCode,
        itemName: plan.part?.itemName ?? plan.itemCode,
        customer: plan.customer ?? '',
        customerName: customerNameMap.get(plan.customer ?? '') ?? '',
        planQty: plan.planQty,
        dueDate,
        priority: plan.priority,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
        onTime,
        delayDays,
        requiredDays,
        bottleneckProcess: bottleneckProcessMap.get(plan.itemCode) ?? '-',
        dailyCapa: itemCapa,
      });
    }

    const schedule = this.buildSchedule(workDays, dayScheduleMap);
    const summary = this.buildSummary(planResults, workDays, schedule, bottleneckMap);

    return { plans: planResults, schedule, summary };
  }

  /** 일자별 스케줄 배열을 구성한다 (빈 날 제외) */
  private buildSchedule(
    workDays: string[],
    dayScheduleMap: Map<string, SimDayItem[]>,
  ): SimDaySchedule[] {
    const schedule: SimDaySchedule[] = [];
    for (const day of workDays) {
      const items = dayScheduleMap.get(day)!;
      if (items.length > 0) {
        schedule.push({
          date: day,
          dayOfWeek: this.getDayOfWeek(day),
          items,
        });
      }
    }
    return schedule;
  }

  /** 시뮬레이션 요약을 생성한다 */
  private buildSummary(
    planResults: SimPlanResult[],
    workDays: string[],
    schedule: SimDaySchedule[],
    bottleneckMap: Map<string, number>,
  ): SimSummary {
    const usedDayCount = schedule.length;
    const utilizationRate =
      workDays.length > 0
        ? Math.round((usedDayCount / workDays.length) * 100 * 10) / 10
        : 0;

    // 소요공수: 품목별 (계획수량 / 일일CAPA) × 8시간
    let requiredHours = 0;
    for (const p of planResults) {
      const dailyCapa = bottleneckMap.get(p.itemCode) ?? 1;
      requiredHours += (p.planQty / dailyCapa) * 8;
    }
    requiredHours = Math.round(requiredHours * 10) / 10;

    // 보유공수: 작업일수 × 8시간
    const availableHours = workDays.length * 8;

    return {
      totalPlans: planResults.length,
      onTimeCount: planResults.filter((p) => p.onTime).length,
      delayCount: planResults.filter((p) => !p.onTime).length,
      totalQty: planResults.reduce((s, p) => s + p.planQty, 0),
      workDays: workDays.length,
      utilizationRate,
      requiredHours,
      availableHours,
    };
  }

  /** 두 날짜 사이의 일수 차이 (endDate - dueDate) */
  private calcDaysDiff(dueDate: string, endDate: string): number {
    const d1 = new Date(dueDate);
    const d2 = new Date(endDate);
    return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
  }

  /** 날짜 문자열에서 요일명을 반환한다 */
  private getDayOfWeek(dateStr: string): string {
    const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
    return DAYS[new Date(dateStr).getDay()];
  }

  /** 빈 결과를 반환한다 */
  private emptyResult(): SimulationResult {
    return {
      plans: [],
      schedule: [],
      summary: {
        totalPlans: 0,
        onTimeCount: 0,
        delayCount: 0,
        totalQty: 0,
        workDays: 0,
        utilizationRate: 0,
        requiredHours: 0,
        availableHours: 0,
      },
    };
  }
}
