/**
 * @file production/input-kiosk/utils/kioskPrepGuideSteps.ts
 * @description 실적입력(가공) 키오스크 준비 안내 단계 계산 (순수 함수)
 *
 * 초보자 가이드:
 * 1. 완료 여부는 헤더(EquipHeader)·실적입력 게이트가 쓰는 것과 같은 kioskStore 상태(선택 설비/작업지시/작업자, interlock)로 계산한다.
 *    안내가 따로 판정하지 않는다 — 헤더와 안내가 서로 다른 말을 하면 현장이 혼란스럽다.
 * 2. 단계 순서: 설비 → 작업지시 → 작업자 → 설비일상점검 → 작업자설비점검 → 자재 스캔 → 소모품 스캔.
 *    헤더의 활성 조건과 같다(작업자설비점검은 일상점검·작업지시·작업자가 있어야, 자재 스캔은 작업지시가 있어야).
 * 3. current/locked 배정 규칙은 공용 assignPrepGuideStatuses 한 곳이다.
 */
import { assignPrepGuideStatuses, type PrepGuideRawStep, type PrepGuideStep } from "@/components/shared/prep-guide";
import type { KioskInterlock } from "@/stores/kioskStore";

export type KioskGuideStepKey =
  | "equip"
  | "jobOrder"
  | "worker"
  | "daily"
  | "workerInspect"
  | "materialScan"
  | "consumableScan";

export type KioskGuideStep = PrepGuideStep<KioskGuideStepKey>;

export interface KioskGuideInput {
  equipName: string | null;
  orderNo: string | null;
  workerNames: string[];
  interlock: KioskInterlock;
  dailyInspectAt: string | null;
  workerInspectAt: string | null;
}

export function buildKioskPrepGuideSteps({
  equipName,
  orderNo,
  workerNames,
  interlock,
  dailyInspectAt,
  workerInspectAt,
}: KioskGuideInput): KioskGuideStep[] {
  const hasEquip = Boolean(equipName);
  const hasOrder = Boolean(orderNo);
  const hasWorker = workerNames.length > 0;

  const raw: PrepGuideRawStep<KioskGuideStepKey>[] = [
    { key: "equip", done: hasEquip, runnable: true, detail: equipName ?? undefined },
    { key: "jobOrder", done: hasOrder, runnable: hasEquip, detail: orderNo ?? undefined },
    { key: "worker", done: hasWorker, runnable: hasEquip, detail: workerNames.join(", ") || undefined },
    { key: "daily", done: hasEquip && interlock.dailyInspectDone, runnable: hasEquip, detail: dailyInspectAt ?? undefined },
    {
      key: "workerInspect",
      done: hasEquip && hasOrder && interlock.workerInspectDone,
      runnable: hasEquip && hasOrder && hasWorker && interlock.dailyInspectDone,
      detail: workerInspectAt ?? undefined,
    },
    { key: "materialScan", done: hasOrder && interlock.materialScanDone, runnable: hasOrder },
    { key: "consumableScan", done: hasEquip && interlock.consumableScanDone, runnable: hasEquip },
  ];

  return assignPrepGuideStatuses(raw);
}
