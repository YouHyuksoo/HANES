/**
 * @file src/modules/production/dto/simulation.dto.ts
 * @description 생산계획 시뮬레이션 응답 타입 정의
 *
 * 초보자 가이드:
 * 1. SimPlanResult: 각 생산계획의 시뮬레이션 결과 (시작일/종료일/납기준수)
 * 2. SimDaySchedule: 일자별 생산 스케줄 (어떤 품목을 얼마나 생산하는지)
 * 3. SimSummary: 전체 요약 (납기 준수율, 가동률 등)
 * 4. SimulationResult: 위 3가지를 합친 최종 응답
 */

/** 계획별 시뮬레이션 결과 */
export interface SimPlanResult {
  planNo: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  customer: string;
  customerName: string;
  planQty: number;
  dueDate: string | null;
  priority: number;
  startDate: string;
  endDate: string;
  onTime: boolean;
  delayDays: number;
  requiredDays: number;
  bottleneckProcess: string;
  dailyCapa: number;
}

/** 일자별 품목 배정 항목 */
export interface SimDayItem {
  planNo: string;
  itemCode: string;
  processCode: string;
  processName: string;
  qty: number;
  cumQty: number;
}

/** 일자별 스케줄 */
export interface SimDaySchedule {
  date: string;
  dayOfWeek: string;
  items: SimDayItem[];
}

/** 시뮬레이션 요약 */
export interface SimSummary {
  totalPlans: number;
  onTimeCount: number;
  delayCount: number;
  totalQty: number;
  workDays: number;
  utilizationRate: number;
  requiredHours: number;
  availableHours: number;
}

/** 시뮬레이션 최종 응답 */
export interface SimulationResult {
  plans: SimPlanResult[];
  schedule: SimDaySchedule[];
  summary: SimSummary;
}
