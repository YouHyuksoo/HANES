/**
 * @file packages/shared/src/utils/consumable-safety-stock-rules.ts
 * @description 소모품 안전재고 사전알림 판정 규칙 — 단일 출처.
 *
 * 부족을 알린 시점에는 이미 늦다. 그래서 두 가지를 같이 본다.
 * 1. 임계 배수 — 안전재고에 닿기 전 여유 구간에서 미리 경고한다.
 * 2. 수명 잔여 — 장착중인 소모품이 곧 수명을 다하면 그만큼 재고가 곧 빠진다.
 *    ACTIVE 수량만 세면 "재고 10개"로 보이지만 장착품 3개가 교체 임박이면 실제 여유는 7개다.
 *
 * 화면(사전알림 페이지, 대시보드 AttentionQueue)과 서버가 같은 판정을 써야 하므로 여기 한 곳에 둔다.
 * 양쪽에 조건을 복사하지 말 것.
 */

/** 임계 배수 설정 키. 값이 없거나 1 미만이면 기본값을 쓴다. */
export const CONSUMABLE_PRE_ALERT_RATIO_KEY = 'CONSUMABLE_PRE_ALERT_RATIO';

/** 기본 임계 배수. 안전재고의 1.2배 이하로 떨어지면 사전경고한다. */
export const CONSUMABLE_PRE_ALERT_RATIO_DEFAULT = 1.2;

export const CONSUMABLE_SAFETY_LEVELS = ['SHORTAGE', 'PRE_ALERT', 'NORMAL', 'NOT_MANAGED'] as const;
export type ConsumableSafetyLevel = typeof CONSUMABLE_SAFETY_LEVELS[number];

export interface ConsumableSafetyInput {
  /** 사용 가능한 재고 인스턴스 수 (ACTIVE, 수명이 남은 것) */
  availableQty: number;
  /** 장착중이면서 수명 경고/교체 상태인 인스턴스 수 — 곧 재고를 먹는다 */
  replacingQty: number;
  /** CONSUMABLE_MASTERS.SAFETY_STOCK */
  safetyStock: number | null | undefined;
}

export interface ConsumableSafetyResult {
  level: ConsumableSafetyLevel;
  /** availableQty - replacingQty. 음수면 0으로 깎지 않는다(부족 정도를 보여야 한다) */
  effectiveQty: number;
  /** 안전재고까지 모자란 수량. 부족이 아니면 0 */
  shortageQty: number;
  /** 판정에 쓴 사전경고 임계 수량 */
  preAlertThreshold: number;
}

function toQty(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** 설정값을 임계 배수로 정규화한다. 1 미만이면 사전경고가 부족보다 늦어지므로 기본값으로 되돌린다. */
export function resolveConsumablePreAlertRatio(raw: string | number | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return CONSUMABLE_PRE_ALERT_RATIO_DEFAULT;
  return n;
}

/**
 * 소모품 한 품목의 안전재고 수준을 판정한다.
 *
 * 안전재고가 설정되지 않은 품목(0 또는 null)은 판정하지 않는다 — 기준이 없으면 부족을 말할 수 없다.
 * 임의로 0을 기준 삼으면 모든 품목이 정상으로 보여 미설정 사실이 묻힌다.
 */
export function resolveConsumableSafetyLevel(
  input: ConsumableSafetyInput,
  ratio: number = CONSUMABLE_PRE_ALERT_RATIO_DEFAULT,
): ConsumableSafetyResult {
  const safetyStock = toQty(input.safetyStock);
  const effectiveQty = toQty(input.availableQty) - toQty(input.replacingQty);

  if (safetyStock <= 0) {
    return { level: 'NOT_MANAGED', effectiveQty, shortageQty: 0, preAlertThreshold: 0 };
  }

  const preAlertThreshold = Math.ceil(safetyStock * resolveConsumablePreAlertRatio(ratio));

  if (effectiveQty <= safetyStock) {
    return { level: 'SHORTAGE', effectiveQty, shortageQty: safetyStock - effectiveQty, preAlertThreshold };
  }
  if (effectiveQty <= preAlertThreshold) {
    return { level: 'PRE_ALERT', effectiveQty, shortageQty: 0, preAlertThreshold };
  }
  return { level: 'NORMAL', effectiveQty, shortageQty: 0, preAlertThreshold };
}

/** 조치가 필요한 수준인가 — 목록 기본 필터와 대시보드 노출 기준 */
export function needsConsumableSafetyAction(level: ConsumableSafetyLevel): boolean {
  return level === 'SHORTAGE' || level === 'PRE_ALERT';
}
