/**
 * @file packages/shared/src/utils/defect-log-rules.ts
 * @description 불량이력(DEFECT_LOGS) 상태 규칙 — 정본 어휘는 공통코드 DEFECT_LOG_STATUS(WAIT/REPAIR/REWORK/SCRAP/DONE).
 *              불량 등록(생산실적), 재작업 연동, 상태 변경 검증이 모두 이 파일 하나를 참조한다.
 *              재작업 공정(REWORK_PROCESSES)의 WAITING 계열(REWORK_PROCESS_STATUS)과는 다른 엔티티의 어휘이므로 섞지 않는다.
 */

/** 공통코드 DEFECT_LOG_STATUS 정본 값 */
export const DEFECT_LOG_STATUS = {
  WAIT: 'WAIT',
  REPAIR: 'REPAIR',
  REWORK: 'REWORK',
  SCRAP: 'SCRAP',
  DONE: 'DONE',
} as const;

export type DefectLogStatus = (typeof DEFECT_LOG_STATUS)[keyof typeof DEFECT_LOG_STATUS];

export const DEFECT_LOG_STATUSES: readonly DefectLogStatus[] = Object.values(DEFECT_LOG_STATUS);

/** 아직 처리(완료/폐기)되지 않은 불량 — 미처리 목록·재작업 대상 판정에 쓴다 */
export const DEFECT_LOG_OPEN_STATUSES: readonly DefectLogStatus[] = [
  DEFECT_LOG_STATUS.WAIT,
  DEFECT_LOG_STATUS.REPAIR,
  DEFECT_LOG_STATUS.REWORK,
];

/** 상태 전이표 — SCRAP/DONE 은 종결 상태라 더 바꿀 수 없다 */
export const DEFECT_LOG_STATUS_TRANSITIONS: Readonly<Record<DefectLogStatus, readonly DefectLogStatus[]>> = {
  WAIT: [DEFECT_LOG_STATUS.REPAIR, DEFECT_LOG_STATUS.REWORK, DEFECT_LOG_STATUS.SCRAP],
  REPAIR: [DEFECT_LOG_STATUS.DONE, DEFECT_LOG_STATUS.SCRAP, DEFECT_LOG_STATUS.WAIT],
  REWORK: [DEFECT_LOG_STATUS.DONE, DEFECT_LOG_STATUS.SCRAP, DEFECT_LOG_STATUS.WAIT],
  SCRAP: [],
  DONE: [],
};

export function isDefectLogStatus(value: string | null | undefined): value is DefectLogStatus {
  return (DEFECT_LOG_STATUSES as readonly string[]).includes(String(value ?? ''));
}

/** 완료/폐기되지 않은 불량인가 */
export function isDefectLogOpen(status: string | null | undefined): boolean {
  return (DEFECT_LOG_OPEN_STATUSES as readonly string[]).includes(String(status ?? ''));
}

/** 현재 상태에서 대상 상태로 바꿀 수 있는가 — 정본 외 값이면 항상 false */
export function canTransitionDefectLogStatus(
  current: string | null | undefined,
  next: string | null | undefined,
): boolean {
  if (!isDefectLogStatus(current) || !isDefectLogStatus(next)) return false;
  return DEFECT_LOG_STATUS_TRANSITIONS[current].includes(next);
}

/** 재작업 검사 결과(REWORK_INSPECT_RESULT: PASS/FAIL/SCRAP) */
export type ReworkInspectResult = 'PASS' | 'FAIL' | 'SCRAP';

/**
 * 재작업 검사 결과 → 연동 불량이력 상태.
 * - PASS: DONE (재작업 완료)
 * - SCRAP: SCRAP (폐기)
 * - FAIL: REWORK (재작업 계속)
 */
export function deriveDefectLogStatusFromReworkInspect(result: ReworkInspectResult | string): DefectLogStatus {
  if (result === 'PASS') return DEFECT_LOG_STATUS.DONE;
  if (result === 'SCRAP') return DEFECT_LOG_STATUS.SCRAP;
  return DEFECT_LOG_STATUS.REWORK;
}
