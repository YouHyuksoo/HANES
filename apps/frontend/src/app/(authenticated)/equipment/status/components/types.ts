/**
 * @file src/app/(authenticated)/equipment/status/components/types.ts
 * @description 설비 가동현황 전광판 스킨 공통 타입/헬퍼.
 *              EquipCard/RunningJob 원본 타입은 EquipStatusCard가 소유하고 여기서 재노출한다.
 */
import type { EquipCard, RunningJob } from "./EquipStatusCard";

export type { EquipCard, RunningJob };

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
