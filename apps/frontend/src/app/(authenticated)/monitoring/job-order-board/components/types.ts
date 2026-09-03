/**
 * @file src/app/(authenticated)/monitoring/job-order-board/components/types.ts
 * @description 작업지시 보드 공통 타입/상수. 데이터 타입은 생산현황 보드(ProductionBoardOrder)를 재사용한다.
 */
import type { ProductionBoardKpi, ProductionBoardOrder } from "../../production-board/components/types";

export type { ProductionBoardOrder, ProductionBoardKpi };

export const JOB_STATUSES = ["WAITING", "RUNNING", "HOLD", "DONE"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** 상태색 — 다크 팔레트 전제. 레드는 상태가 아니라 "조치 필요" 강조에만 쓴다. */
export const STATUS_COLOR: Record<JobStatus, string> = {
  WAITING: "#7c8aa5",
  RUNNING: "#22d3ee",
  HOLD: "#fbbf24",
  DONE: "#34d399",
};
export const ALERT = "#ef4444";

export function asJobStatus(s: string): JobStatus {
  return (JOB_STATUSES as readonly string[]).includes(s) ? (s as JobStatus) : "WAITING";
}

/** 스킨 공통 props — page.tsx가 데이터/설정을 내려준다 */
export interface JobOrderSkinProps {
  kpi?: ProductionBoardKpi;
  orders: ProductionBoardOrder[];
  byStatus: Record<JobStatus, ProductionBoardOrder[]>;
  rollingSec: number;
  paused: boolean;
  updatedAt: string;
}
