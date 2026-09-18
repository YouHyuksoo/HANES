/**
 * @file inspection/result/hooks/prepGuideSteps.ts
 * @description 통전·단자검사 준비 안내 단계 계산 (순수 함수)
 *
 * 초보자 가이드:
 * 1. 화면 진입 시 중앙 안내 모달이 "다음에 뭘 해야 하는지"를 한 단계씩 보여준다.
 * 2. 완료 여부는 헤더(InspectStationHeader)가 쓰는 것과 같은 prep 상태에서 계산한다.
 *    안내 모달이 따로 판정하지 않는다 — 헤더와 안내가 서로 다른 말을 하면 현장이 혼란스럽다.
 * 3. 단계 순서: 검사기 → 작업자 → 작업지시 → 설비일상점검 → 작업자설비점검 → 양불마스터 대조.
 *    작업자설비점검·양불대조는 작업지시가 있어야 하므로 작업지시 선택을 그 앞에 둔다.
 * 4. locked = 앞 단계가 안 끝나 아직 실행할 수 없는 단계. current = 첫 번째 미완료·실행 가능 단계.
 */
import type { InspectPrepState } from "./useInspectPrepStatus";

export type PrepGuideStepKey =
  | "equip"
  | "worker"
  | "order"
  | "daily"
  | "workerInspect"
  | "sampleCheck";

export type PrepGuideStepStatus = "done" | "current" | "locked" | "notTarget";

export interface PrepGuideStep {
  key: PrepGuideStepKey;
  status: PrepGuideStepStatus;
  /** 완료 시 보조 문구(점검 시각 등) */
  detail?: string;
}

export interface PrepGuideInput {
  hasEquip: boolean;
  hasOrder: boolean;
  prep: Pick<InspectPrepState, "gate" | "sampleCheck" | "workers">;
}

/** 단계별 완료 여부와 실행 가능 여부를 계산한다. */
export function buildPrepGuideSteps({ hasEquip, hasOrder, prep }: PrepGuideInput): PrepGuideStep[] {
  const hasWorker = prep.workers.length > 0;
  // prep-status는 작업지시가 있어야 조회되므로, 작업지시 전에는 점검 완료를 판단하지 않는다.
  const dailyDone = hasEquip && hasOrder && (!prep.gate.dailyRequired || prep.gate.dailyDone);
  const workerInspectDone = hasEquip && hasOrder && hasWorker && (!prep.gate.workerRequired || prep.gate.workerDone);
  const sampleRequired = prep.sampleCheck?.required ?? false;
  const sampleNotTarget = hasEquip && hasOrder && prep.sampleCheck !== null && !sampleRequired;
  const sampleDone = hasEquip && hasOrder && sampleRequired && (prep.sampleCheck?.done ?? false);

  const raw: Array<{ key: PrepGuideStepKey; done: boolean; runnable: boolean; notTarget?: boolean; detail?: string }> = [
    { key: "equip", done: hasEquip, runnable: true },
    { key: "worker", done: hasWorker, runnable: hasEquip, detail: prep.workers.map((w) => w.workerName).join(", ") || undefined },
    { key: "order", done: hasOrder, runnable: true },
    { key: "daily", done: dailyDone, runnable: hasEquip && hasOrder, detail: prep.gate.dailyInspectedAt ?? undefined },
    { key: "workerInspect", done: workerInspectDone, runnable: hasEquip && hasOrder && hasWorker, detail: prep.gate.workerInspectedAt ?? undefined },
    {
      key: "sampleCheck",
      done: sampleDone,
      runnable: hasEquip && hasOrder,
      notTarget: sampleNotTarget,
      detail: prep.sampleCheck ? `${prep.sampleCheck.workDate} ${prep.sampleCheck.shiftCode}` : undefined,
    },
  ];

  let currentAssigned = false;
  return raw.map((s) => {
    if (s.notTarget) return { key: s.key, status: "notTarget", detail: s.detail };
    if (s.done) return { key: s.key, status: "done", detail: s.detail };
    if (s.runnable && !currentAssigned) {
      currentAssigned = true;
      return { key: s.key, status: "current", detail: s.detail };
    }
    return { key: s.key, status: "locked", detail: s.detail };
  });
}

/** 현재 진행해야 할 단계. 전부 끝났으면 null. */
export function findCurrentGuideStep(steps: PrepGuideStep[]): PrepGuideStep | null {
  return steps.find((s) => s.status === "current") ?? null;
}

/** 완료(대상 없음 포함) 단계 수 */
export function countGuideDone(steps: PrepGuideStep[]): number {
  return steps.filter((s) => s.status === "done" || s.status === "notTarget").length;
}
