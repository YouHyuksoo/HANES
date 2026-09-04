/**
 * @file packages/shared/src/utils/job-order-rules.ts
 * @description 작업지시 상태 규칙 — 프론트(키오스크 복원)와 백엔드(설비 바인딩 해제)가 함께 쓴다.
 */

/** 더 이상 작업할 수 없는 종결 상태 */
export const JOB_ORDER_FINISHED_STATUSES = ['DONE', 'CANCELED'] as const;

/** 완료/취소된 작업지시인가 — 설비에 묶여 있어도 키오스크가 복원하면 안 된다 */
export function isJobOrderFinished(status: string | null | undefined): boolean {
  return (JOB_ORDER_FINISHED_STATUSES as readonly string[]).includes(String(status ?? '').toUpperCase());
}

/** 실적 합계로 정하는 작업지시 상태 — 저장·취소·완료 어느 경로든 이 함수 하나로 판정한다 */
export type JobOrderDerivedStatus = 'WAITING' | 'RUNNING' | 'DONE';

export interface JobOrderResultTotals {
  /** 취소되지 않은 실적 건수 */
  resultCount: number;
  /** 취소되지 않은 실적 양품 합계 */
  totalGoodQty: number;
  /** 작업지시 계획수량 */
  planQty: number;
}

/**
 * 실적 합계 → 작업지시 상태.
 * - 실적 0건: WAITING (첫 실적이 취소되어 없어지면 대기로 되돌린다)
 * - 양품 합계 ≥ 계획수량(계획 > 0): DONE (계획 달성 시 자동 완료)
 * - 그 외: RUNNING
 * 계획수량이 0 이하면 자동 완료하지 않는다(수동 완료만).
 */
export function deriveJobOrderStatusFromResults({ resultCount, totalGoodQty, planQty }: JobOrderResultTotals): JobOrderDerivedStatus {
  if (resultCount <= 0) return 'WAITING';
  if (planQty > 0 && totalGoodQty >= planQty) return 'DONE';
  return 'RUNNING';
}

/** 실적 반영으로 상태를 자동 전이해도 되는가 — HOLD/CANCELED 는 사람이 정한 상태라 실적이 바꾸지 않는다 */
export function canAutoTransitionJobOrder(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return s !== 'HOLD' && s !== 'CANCELED';
}

