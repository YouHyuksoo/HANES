/**
 * @file inspection/result/hooks/prepGuideSteps.ts
 * @description 통전·단자검사 준비 안내 단계 계산 (순수 함수)
 *
 * 초보자 가이드:
 * 1. 화면 진입 시 중앙 안내 모달(공용 PrepGuideModal)이 "다음에 뭘 해야 하는지"를 한 단계씩 보여준다.
 * 2. 완료 여부는 헤더(InspectStationHeader)가 쓰는 것과 같은 prep 상태에서 계산한다.
 *    안내 모달이 따로 판정하지 않는다 — 헤더와 안내가 서로 다른 말을 하면 현장이 혼란스럽다.
 * 3. 단계 순서: 검사기 → 작업자 → 작업지시 → 설비일상점검 → 작업자설비점검 → 양불마스터 대조.
 *    작업자설비점검·양불대조는 작업지시가 있어야 하므로 작업지시 선택을 그 앞에 둔다.
 * 4. current/locked 배정 규칙은 공용 assignPrepGuideStatuses 한 곳이다.
 */
import { assignPrepGuideStatuses, type PrepGuideRawStep, type PrepGuideStep } from "@/components/shared/prep-guide";
import type { InspectPrepState } from "./useInspectPrepStatus";

export type InspectGuideStepKey =
  | "equip"
  | "worker"
  | "order"
  | "daily"
  | "workerInspect"
  | "sampleCheck";

export type InspectGuideStep = PrepGuideStep<InspectGuideStepKey>;

export interface InspectGuideInput {
  hasEquip: boolean;
  hasOrder: boolean;
  prep: Pick<InspectPrepState, "gate" | "sampleCheck" | "workers">;
}

/** 단계별 완료 여부와 실행 가능 여부를 계산한다. */
export function buildPrepGuideSteps({ hasEquip, hasOrder, prep }: InspectGuideInput): InspectGuideStep[] {
  const hasWorker = prep.workers.length > 0;
  // prep-status는 작업지시가 있어야 조회되므로, 작업지시 전에는 점검 완료를 판단하지 않는다.
  const dailyDone = hasEquip && hasOrder && (!prep.gate.dailyRequired || prep.gate.dailyDone);
  const workerInspectDone = hasEquip && hasOrder && hasWorker && (!prep.gate.workerRequired || prep.gate.workerDone);
  const sampleRequired = prep.sampleCheck?.required ?? false;
  const sampleNotTarget = hasEquip && hasOrder && prep.sampleCheck !== null && !sampleRequired;
  const sampleDone = hasEquip && hasOrder && sampleRequired && (prep.sampleCheck?.done ?? false);

  const raw: PrepGuideRawStep<InspectGuideStepKey>[] = [
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

  return assignPrepGuideStatuses(raw);
}
