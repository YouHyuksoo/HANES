/**
 * @file src/modules/production/services/simulation-helper.ts
 * @description 시뮬레이션 스케줄링 결과를 가공하는 순수 헬퍼 함수 모음.
 *
 * 초보자 가이드:
 * 1. buildSchedule: 날짜별 스케줄 배열 구성 (빈 날 제외)
 * 2. buildSummary: 시뮬레이션 요약 통계 생성
 * 3. calcDaysDiff: 두 날짜 사이의 일수 차이
 * 4. getDayOfWeek: 날짜 → 요일명
 * 5. emptyResult: 빈 시뮬레이션 결과 생성
 *
 * 이 파일의 함수들은 클래스 인스턴스가 아닌 순수 함수이므로
 * SimulationService에서 import하여 직접 호출한다.
 */

import { ProdPlan } from '../../../entities/prod-plan.entity';
import {
  SimulationResult,
  SimPlanResult,
  SimDayItem,
  SimDaySchedule,
  SimSummary,
} from '../dto/simulation.dto';

/** 일자별 스케줄 배열을 구성한다 (빈 날 제외) */
export function buildSchedule(
  workDays: string[],
  dayScheduleMap: Map<string, SimDayItem[]>,
): SimDaySchedule[] {
  const schedule: SimDaySchedule[] = [];
  for (const day of workDays) {
    const items = dayScheduleMap.get(day)!;
    if (items.length > 0) {
      schedule.push({
        date: day,
        dayOfWeek: getDayOfWeek(day),
        items,
      });
    }
  }
  return schedule;
}

/** 시뮬레이션 요약을 생성한다 */
export function buildSummary(
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
export function calcDaysDiff(dueDate: string, endDate: string): number {
  const d1 = new Date(dueDate);
  const d2 = new Date(endDate);
  return Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

/** 날짜 문자열에서 요일명을 반환한다 */
export function getDayOfWeek(dateStr: string): string {
  const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
  return DAYS[new Date(dateStr).getDay()];
}

/**
 * 납기순 -> 우선순위순으로 계획을 정렬한다.
 * 납기가 없는 계획은 뒤로 밀린다.
 */
export function sortPlansByDueDate(
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
 * 품목 그룹 내에서는 납기순 -> 우선순위순.
 */
export function sortByMinSetup(
  plans: ProdPlan[],
  dueDateMap: Map<string, string | null>,
): ProdPlan[] {
  return [...plans].sort((a, b) => {
    if (a.itemCode !== b.itemCode) return a.itemCode.localeCompare(b.itemCode);
    const da = dueDateMap.get(a.planNo);
    const db = dueDateMap.get(b.planNo);
    if (!da && db) return 1;
    if (da && !db) return -1;
    if (da && db && da !== db) return da.localeCompare(db);
    return (a.priority ?? 5) - (b.priority ?? 5);
  });
}

/** 빈 결과를 반환한다 */
export function emptyResult(): SimulationResult {
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
