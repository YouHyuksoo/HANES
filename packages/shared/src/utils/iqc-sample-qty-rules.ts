/**
 * @file packages/shared/src/utils/iqc-sample-qty-rules.ts
 * @description IQC AQL 산출값에서 화면에 보여줄 시료수를 고르는 공통 규칙 — 단일 출처.
 *
 * 배경(2026-09-16 점검): `resolveIqcPolicyByItem`의 `sampleQty`는 모든 검사항목 소요량의 최댓값이다.
 * 품목에 전수(FULL) 검사항목이 하나라도 있으면 그 항목의 소요량이 모집단 수량이라 `sampleQty`가
 * 모집단과 같아진다. 화면이 그 값을 "예상 시료수"로 쓰면 담당자는 모집단 전량을 뽑아야 하는 것으로 읽는다.
 *
 * 그래서 표시용은 AQL 샘플링 항목만의 `aqlSampleQty`를 쓰고, 전수/파괴 소요량은 `fullInspectQty`로
 * 따로 보여준다. 판정과 IQC_LOGS 적재는 종전대로 `sampleQty`를 쓴다(의미가 다르다).
 */

export interface IqcSampleQtySource {
  /** 전 항목 최댓값. 판정/로그용 */
  sampleQty?: number | null;
  /** AQL 샘플링 항목만의 시료수. 표시용 */
  aqlSampleQty?: number | null;
  /** 전수(FULL)/파괴/고정 항목이 요구하는 검사수량 */
  fullInspectQty?: number | null;
}

function toPositive(value: number | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * 화면에 "예상 시료수"로 보여줄 값.
 * `aqlSampleQty`가 없는 응답(구버전/캐시)은 `sampleQty`로 떨어진다.
 */
export function resolveIqcDisplaySampleQty(policy: IqcSampleQtySource | null | undefined): number | null {
  if (!policy) return null;
  if (policy.aqlSampleQty !== undefined && policy.aqlSampleQty !== null) return toPositive(policy.aqlSampleQty);
  return toPositive(policy.sampleQty);
}

/** 전수/파괴 검사항목이 따로 요구하는 검사수량. 없으면 null. */
export function resolveIqcFullInspectQty(policy: IqcSampleQtySource | null | undefined): number | null {
  if (!policy) return null;
  return toPositive(policy.fullInspectQty);
}
