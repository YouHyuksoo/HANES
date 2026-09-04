/**
 * @file packages/shared/src/utils/consumable-rules.ts
 * @description 소모품(금형/치공구/장착 롯트) 수명 상태 공통 규칙 — CONSUMABLE_STATUS 공통코드 기준.
 *
 * 타수/사용량 누적 후 상태를 재판정하는 규칙의 단일 출처.
 * 소모품관리(updateShotCount), 설비 소모품(updateWarningStatus), 생산실적(금형 타수 누적)이 함께 쓴다.
 */

/** 수명 임계로 자동 판정되는 상태 집합 — 이 집합 밖의 상태(예: 폐기 등)는 규칙이 덮어쓰지 않는다 */
export const CONSUMABLE_LIFE_MANAGED_STATUSES = ['NORMAL', 'WARNING', 'REPLACE'] as const;
export type ConsumableLifeStatus = typeof CONSUMABLE_LIFE_MANAGED_STATUSES[number];

/**
 * 누적 타수 대비 수명 상태 판정
 *
 * 1. expectedLife 가 있고 count ≥ expectedLife → 'REPLACE'
 * 2. warningCount 가 있고 count ≥ warningCount → 'WARNING'
 * 3. 그 외: current 가 WARNING/REPLACE 였으면 'NORMAL' 로 복귀(타수 감소·교체 반영), 아니면 current 유지
 *
 * 3번에서 current 를 유지하는 이유: 수명 외 사유의 상태(폐기 등)를 타수 갱신이 덮어쓰지 않기 위함.
 * 임계값이 0/null 이면 해당 임계는 "미설정"으로 보고 건너뛴다.
 */
export function resolveConsumableLifeStatus(
  count: number,
  warningCount: number | null | undefined,
  expectedLife: number | null | undefined,
  current: string | null | undefined,
): string {
  if (expectedLife && count >= expectedLife) return 'REPLACE';
  if (warningCount && count >= warningCount) return 'WARNING';
  const currentStatus = current ?? 'NORMAL';
  return currentStatus === 'WARNING' || currentStatus === 'REPLACE' ? 'NORMAL' : currentStatus;
}
