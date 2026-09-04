/**
 * @file packages/shared/src/utils/mat-lot-rules.ts
 * @description 자재 LOT(MAT_LOTS.STATUS) 상태 규칙 — 출고/병합/분할/보류/유효기간 서비스와 프론트 배지·필터가 함께 쓴다.
 *
 * 정본 어휘는 공통코드 MAT_LOT_STATUS(NORMAL/HOLD/DEPLETED/SPLIT/MERGED/DISCARDED)다.
 * - NORMAL    : 정상. 출고·병합·분할·실사·보류의 대상이 되는 유일한 활성 상태
 * - HOLD      : 보류. 사람이 해제(NORMAL)하기 전까지 출고·병합·분할 불가
 * - DEPLETED  : 소진. 잔량 0 (출고 취소로 NORMAL 복귀 가능)
 * - SPLIT     : 분할완료. 원본 종결, 자식 LOT 이 NORMAL 로 생성됨
 * - MERGED    : 병합완료. 원본 종결, 통합 LOT 이 NORMAL 로 생성됨
 * - DISCARDED : 폐기. 유효기간 재검사 불합격 → 불용창고 이동, 다시 살아나지 않음
 */

export const MAT_LOT_STATUS = {
  NORMAL: 'NORMAL',
  HOLD: 'HOLD',
  DEPLETED: 'DEPLETED',
  SPLIT: 'SPLIT',
  MERGED: 'MERGED',
  DISCARDED: 'DISCARDED',
} as const;

export type MatLotStatus = (typeof MAT_LOT_STATUS)[keyof typeof MAT_LOT_STATUS];

/** 공통코드 MAT_LOT_STATUS 와 같은 전체 집합 */
export const MAT_LOT_STATUSES: readonly MatLotStatus[] = Object.values(MAT_LOT_STATUS);

/** 활성 상태 — 출고/병합/분할/보류/실사 대상이 되는 상태. 현재는 NORMAL 하나다. */
export const MAT_LOT_ACTIVE_STATUSES = [MAT_LOT_STATUS.NORMAL] as const;

/** 살아있는 상태 — 종결되지 않아 입고(입하→창고) 대상이 되는 상태. 보류 LOT 도 입고는 된다. */
export const MAT_LOT_LIVE_STATUSES = [MAT_LOT_STATUS.NORMAL, MAT_LOT_STATUS.HOLD] as const;

/** 종결 상태 — 잔량이 남아 있어도 다시 살아나지 않는다(DEPLETED 는 출고 취소로만 복귀). */
export const MAT_LOT_TERMINAL_STATUSES = [
  MAT_LOT_STATUS.DEPLETED,
  MAT_LOT_STATUS.SPLIT,
  MAT_LOT_STATUS.MERGED,
  MAT_LOT_STATUS.DISCARDED,
] as const;

function normalize(status: string | null | undefined): string {
  return String(status ?? '').trim().toUpperCase();
}

/** 정상(NORMAL) 인가 — 출고·병합·분할·보류의 전제 */
export function isMatLotActive(status: string | null | undefined): boolean {
  return (MAT_LOT_ACTIVE_STATUSES as readonly string[]).includes(normalize(status));
}

/** 보류(HOLD) 인가 */
export function isMatLotOnHold(status: string | null | undefined): boolean {
  return normalize(status) === MAT_LOT_STATUS.HOLD;
}

/** 종결 상태인가 — DEPLETED/SPLIT/MERGED/DISCARDED. 재고가 남아 있어도 출고·병합·분할·보류 불가 */
export function isMatLotTerminal(status: string | null | undefined): boolean {
  return (MAT_LOT_TERMINAL_STATUSES as readonly string[]).includes(normalize(status));
}

/** 입고(창고 적재) 대상이 되는가 — 종결되지 않은 NORMAL/HOLD */
export function isMatLotReceivable(status: string | null | undefined): boolean {
  return (MAT_LOT_LIVE_STATUSES as readonly string[]).includes(normalize(status));
}

/** 출고(수동/스캔/출고요청) 가능한가 — NORMAL 만. 상태 미상(null)은 출고 불가 */
export function isMatLotIssuable(status: string | null | undefined): boolean {
  return isMatLotActive(status);
}

/** 병합·분할 원본이 될 수 있는가 — 출고 가능 조건과 같다(NORMAL) */
export function isMatLotMergeableOrSplittable(status: string | null | undefined): boolean {
  return isMatLotActive(status);
}

/** 보류를 걸 수 있는가 — NORMAL 만. 이미 HOLD 이거나 종결이면 불가 */
export function canHoldMatLot(status: string | null | undefined): boolean {
  return isMatLotActive(status);
}

/** 보류를 해제할 수 있는가 — HOLD 만 */
export function canReleaseMatLot(status: string | null | undefined): boolean {
  return isMatLotOnHold(status);
}
