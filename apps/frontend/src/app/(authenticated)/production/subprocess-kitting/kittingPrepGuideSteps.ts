/**
 * @file production/subprocess-kitting/kittingPrepGuideSteps.ts
 * @description 실적입력(서브공정) 키팅 준비 안내 단계 계산 (순수 함수)
 *
 * 초보자 가이드:
 * 1. 완료 여부는 상단 바·SFG 발행 게이트(canIssue)가 쓰는 것과 같은 상태로 계산한다.
 *    여기서 새 규칙을 만들지 않는다 — 안내와 실제 게이트가 갈리면 안내가 거짓말이 된다.
 * 2. 단계 순서: 설비 → 작업지시 → 회로 → 작업자 → 설비일상점검 → 작업자설비점검 → 대차.
 *    이전 공정 SFG 스캔은 SFG 1개마다 반복하는 본작업이라 준비 단계에 넣지 않는다(조립과 같은 판단).
 * 3. 회로는 품목에 회로가 없으면(circuitCount === 0) notTarget — 발행·확정 가드와 같은 조건이다.
 * 4. 환경설정(SUBASSEMBLY_*_INSPECT_REQUIRED)이 꺼진 점검은 notTarget — 헤더 카드와 같은 규칙.
 * 5. current/locked 배정 규칙은 공용 assignPrepGuideStatuses 한 곳이다.
 */
import { assignPrepGuideStatuses, type PrepGuideRawStep, type PrepGuideStep } from "@/components/shared/prep-guide";
import type { KioskInterlock } from "@/stores/kioskStore";

export type KittingGuideStepKey =
  | "equip" | "jobOrder" | "circuit" | "worker" | "daily" | "workerInspect" | "carrier";

export type KittingGuideStep = PrepGuideStep<KittingGuideStepKey>;

export interface KittingGuideInput {
  equipName: string | null;
  orderNo: string | null;
  circuitNo: string | null;
  /** 이 작업지시 품목의 회로 개수. 0이면 회로 단계는 대상 아님 */
  circuitCount: number;
  workerNames: string[];
  interlock: Pick<KioskInterlock, "dailyInspectDone" | "workerInspectDone">;
  dailyInspectRequired: boolean;
  workerInspectRequired: boolean;
  dailyInspectResult: string | null;
  workerInspectResult: string | null;
  carrierRequired: boolean;
  carrierNo: string | null;
}

export function buildKittingPrepGuideSteps({
  equipName,
  orderNo,
  circuitNo,
  circuitCount,
  workerNames,
  interlock,
  dailyInspectRequired,
  workerInspectRequired,
  dailyInspectResult,
  workerInspectResult,
  carrierRequired,
  carrierNo,
}: KittingGuideInput): KittingGuideStep[] {
  const hasEquip = Boolean(equipName);
  const hasOrder = Boolean(orderNo);
  const hasWorker = workerNames.length > 0;
  const dailyOk = !dailyInspectRequired || interlock.dailyInspectDone;

  const raw: PrepGuideRawStep<KittingGuideStepKey>[] = [
    { key: "equip", done: hasEquip, runnable: true, detail: equipName ?? undefined },
    { key: "jobOrder", done: hasOrder, runnable: hasEquip, detail: orderNo ?? undefined },
    {
      key: "circuit",
      done: Boolean(circuitNo),
      runnable: hasOrder && circuitCount > 0,
      notTarget: circuitCount === 0,
      detail: circuitNo ?? undefined,
    },
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
    {
      key: "carrier",
      done: Boolean(carrierNo),
      runnable: hasEquip && hasOrder,
      notTarget: !carrierRequired,
      detail: carrierNo ?? undefined,
    },
  ];

  return assignPrepGuideStatuses(raw);
}
