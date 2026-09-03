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
