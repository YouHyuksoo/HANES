/**
 * @file src/app/(authenticated)/monitoring/equipment-board/components/types.ts
 * @description 설비가동 보드 타입/헬퍼 — GET /equipment/equips + GET /production/progress?status=RUNNING 조인.
 */

/** /equipment/equips 응답 항목 (보드에서 쓰는 필드만) */
export interface EquipCard {
  id: string;
  equipCode: string;
  equipName: string;
  equipType: string | null;
  lineCode: string | null;
  processCode: string | null;
  processName: string | null;
  status: string;
  ipAddress: string | null;
  modelName: string | null;
  maker: string | null;
  currentJobOrderId: string | null;
}

/** 해당 설비에서 현재 작업(RUNNING) 중인 작업지시 요약 */
export interface RunningJob {
  orderNo: string;
  itemName: string | null;
  planQty: number;
  goodQty: number;
  defectQty: number;
}

export interface EquipStatusCounts {
  NORMAL: number;
  MAINT: number;
  STOP: number;
  INTERLOCK: number;
}

/** 스킨 공통 props — page.tsx가 필터·조인된 데이터와 순환 설정을 내려준다 */
export interface EquipSkinProps {
  equips: EquipCard[];
  jobMap: Map<string, RunningJob>;
  counts: EquipStatusCounts;
  workingCount: number;
  rollingSec: number;
  paused: boolean;
  updatedAt: string;
}

/** 표시 상태: 정상+작업중(RUN) / 정상+대기(IDLE) / 점검 / 정지 / 인터록 */
export type EquipVisualState = "RUN" | "IDLE" | "MAINT" | "STOP" | "INTERLOCK";

export function visualState(e: EquipCard, job: RunningJob | undefined): EquipVisualState {
  if (e.status === "STOP") return "STOP";
  if (e.status === "MAINT") return "MAINT";
  if (e.status === "INTERLOCK") return "INTERLOCK";
  return job ? "RUN" : "IDLE";
}

export const STATE_COLOR: Record<EquipVisualState, string> = {
  RUN: "#34d399",
  IDLE: "#38bdf8",
  MAINT: "#fbbf24",
  STOP: "#ef4444",
  INTERLOCK: "#9ca3af",
};

/** 달성률(%) — 계획 0이면 0 */
export function achieveRate(job: RunningJob | undefined): number {
  if (!job || job.planQty <= 0) return 0;
  return Math.round((job.goodQty / job.planQty) * 100);
}
