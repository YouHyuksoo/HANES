/**
 * @file src/app/(authenticated)/monitoring/job-order-board/components/metrics.ts
 * @description 작업지시 보드 지표 — 계획/실적/불량 세 숫자에서 파생되는 값만 계산한다.
 *
 * 초보자 가이드:
 * - 달성률 = 실적 / 계획, 불량률 = 불량 / (실적 + 불량), 잔량 = 계획 − 실적
 * - 보드의 주축은 공정 → 작업지시. groupByProcess 가 그 구조를 만든다.
 * - 정렬: 진행 → 홀딩 → 대기 → 완료, 같은 상태면 우선순위 → 지시번호
 */
import { asJobStatus, type JobStatus, type ProductionBoardOrder } from "./types";

export interface Metrics {
  plan: number;
  good: number;
  defect: number;
  remaining: number;
  /** 0~100 (소수 1자리) */
  achieveRate: number;
  /** 0~100 (소수 1자리) */
  defectRate: number;
}

export interface OrderRow {
  order: ProductionBoardOrder;
  status: JobStatus;
  m: Metrics;
}

export interface ProcessGroup {
  process: string;
  rows: OrderRow[];
  total: Metrics;
  counts: Record<JobStatus, number>;
}

const STATUS_RANK: Record<JobStatus, number> = { RUNNING: 0, HOLD: 1, WAITING: 2, DONE: 3 };

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

export function metricsOf(plan: number, good: number, defect: number): Metrics {
  return {
    plan, good, defect,
    remaining: Math.max(0, plan - good),
    achieveRate: pct(good, plan),
    defectRate: pct(defect, good + defect),
  };
}

export function toRow(o: ProductionBoardOrder): OrderRow {
  return { order: o, status: asJobStatus(o.status), m: metricsOf(o.planQty, o.goodQty, o.defectQty) };
}

export function sortRows(rows: OrderRow[]): OrderRow[] {
  return [...rows].sort((a, b) =>
    STATUS_RANK[a.status] - STATUS_RANK[b.status]
    || a.order.priority - b.order.priority
    || a.order.orderNo.localeCompare(b.order.orderNo));
}

/** 공정별 그룹. 진행·홀딩이 많은 공정이 먼저, 그다음 공정코드순. */
export function groupByProcess(orders: ProductionBoardOrder[]): ProcessGroup[] {
  const m = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const key = o.processCode ?? "—";
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(toRow(o));
  }
  return [...m.entries()]
    .map(([process, list]) => {
      const rows = sortRows(list);
      const counts: Record<JobStatus, number> = { RUNNING: 0, HOLD: 0, WAITING: 0, DONE: 0 };
      let plan = 0, good = 0, defect = 0;
      for (const r of rows) { counts[r.status]++; plan += r.m.plan; good += r.m.good; defect += r.m.defect; }
      return { process, rows, total: metricsOf(plan, good, defect), counts };
    })
    .sort((a, b) => (b.counts.RUNNING + b.counts.HOLD) - (a.counts.RUNNING + a.counts.HOLD) || a.process.localeCompare(b.process));
}
