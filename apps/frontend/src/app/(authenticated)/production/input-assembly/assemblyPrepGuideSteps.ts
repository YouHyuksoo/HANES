/**
 * @file production/input-assembly/assemblyPrepGuideSteps.ts
 * @description 실적입력(조립) 준비 안내 단계 계산 (순수 함수)
 *
 * 초보자 가이드:
 * 1. 완료 여부는 상단 바·FG 발행 게이트(canIssue)가 쓰는 것과 같은 상태로 계산한다.
 *    설비/작업지시는 페이지 상태, 작업자·점검 완료는 kioskStore(selectedWorkers, interlock).
 * 2. 단계 순서: 설비 → 작업지시 → 작업자 → 설비일상점검 → 작업자설비점검.
 *    반제품(SG) 스캔은 FG 1개마다 반복하는 본작업이라 준비 단계에 넣지 않는다.
 * 3. 환경설정(ASSEMBLY_*_INSPECT_REQUIRED)이 꺼진 점검은 notTarget — 헤더 카드와 같은 규칙.
 * 4. current/locked 배정 규칙은 공용 assignPrepGuideStatuses 한 곳이다.
 */
import { assignPrepGuideStatuses, type PrepGuideRawStep, type PrepGuideStep } from "@/components/shared/prep-guide";
import type { KioskInterlock } from "@/stores/kioskStore";

export type AssemblyGuideStepKey = "equip" | "jobOrder" | "worker" | "daily" | "workerInspect";

export type AssemblyGuideStep = PrepGuideStep<AssemblyGuideStepKey>;

export interface AssemblyGuideInput {
  equipName: string | null;
  orderNo: string | null;
  workerNames: string[];
  interlock: Pick<KioskInterlock, "dailyInspectDone" | "workerInspectDone">;
  dailyInspectRequired: boolean;
  workerInspectRequired: boolean;
  dailyInspectResult: string | null;
  workerInspectResult: string | null;
}

export function buildAssemblyPrepGuideSteps({
  equipName,
  orderNo,
  workerNames,
  interlock,
  dailyInspectRequired,
  workerInspectRequired,
  dailyInspectResult,
  workerInspectResult,
}: AssemblyGuideInput): AssemblyGuideStep[] {
  const hasEquip = Boolean(equipName);
  const hasOrder = Boolean(orderNo);
  const hasWorker = workerNames.length > 0;
  const dailyOk = !dailyInspectRequired || interlock.dailyInspectDone;

  const raw: PrepGuideRawStep<AssemblyGuideStepKey>[] = [
    { key: "equip", done: hasEquip, runnable: true, detail: equipName ?? undefined },
    { key: "jobOrder", done: hasOrder, runnable: hasEquip, detail: orderNo ?? undefined },
    { key: "worker", done: hasWorker, runnable: hasEquip, detail: workerNames.join(", ") || undefined },
    {
      key: "daily",
      done: hasEquip && interlock.dailyInspectDone,
      runnable: hasEquip,
      notTarget: !dailyInspectRequired,
      detail: dailyInspectResult ?? undefined,
    },
    {
      key: "workerInspect",
      done: hasEquip && hasOrder && interlock.workerInspectDone,
      runnable: hasEquip && hasOrder && hasWorker && dailyOk,
      notTarget: !workerInspectRequired,
      detail: workerInspectResult ?? undefined,
    },
  ];

  return assignPrepGuideStatuses(raw);
}
