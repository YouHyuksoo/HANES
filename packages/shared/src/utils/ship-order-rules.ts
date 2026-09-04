/**
 * @file packages/shared/src/utils/ship-order-rules.ts
 * @description 출하지시(SHIPMENT_ORDERS) 상태 규칙 — 백엔드(박스/팔레트 출하·취소·역분개)와 프론트(목록 미완료 판정)가 함께 쓴다.
 *
 * 정본 어휘 = COM_CODES.SHIP_ORDER_STATUS (2026-09-04 실측: DRAFT/CONFIRMED/SHIPPING/SHIPPED/CLOSED).
 * 백엔드 흐름은 DRAFT → CONFIRMED → CLOSED 다. 라인 전량 출하 시 CLOSED, 출하분이 되돌아오면 CONFIRMED.
 * SHIPPING/SHIPPED 는 공통코드에 정의돼 있으나 현재 어떤 경로도 만들지 않는다(범례·필터 표시용).
 */

/** COM_CODES.SHIP_ORDER_STATUS 정본 집합 */
export const SHIP_ORDER_STATUSES = ['DRAFT', 'CONFIRMED', 'SHIPPING', 'SHIPPED', 'CLOSED'] as const;
export type ShipOrderStatus = (typeof SHIP_ORDER_STATUSES)[number];

/** 미완료(작업 대상) 상태 — 목록 기본 필터에서 기간 밖이어도 항상 노출한다 */
export const SHIP_ORDER_OPEN_STATUSES = ['DRAFT', 'CONFIRMED', 'SHIPPING'] as const;

export function isShipOrderOpen(status: string | null | undefined): boolean {
  return (SHIP_ORDER_OPEN_STATUSES as readonly string[]).includes(String(status ?? '').toUpperCase());
}

/** 출하수량 합계로 정하는 출하지시 상태 — 박스출하·팔레트출하·출하취소·역분개 어느 경로든 이 함수 하나로 판정한다 */
export type ShipOrderDerivedStatus = 'CONFIRMED' | 'CLOSED';

export interface ShipOrderLineQty {
  /** 지시수량 */
  orderQty: number;
  /** 기출하수량(이번 처리분을 반영한 값) */
  shippedQty: number | null;
}

/** 모든 라인이 지시수량 이상 출하됐는가. 라인이 0건이면 false(출하할 것이 없으면 종결이 아니다). */
export function isShipOrderFullyShipped(lines: ReadonlyArray<ShipOrderLineQty>): boolean {
  if (lines.length === 0) return false;
  return lines.every((line) => (line.shippedQty ?? 0) >= line.orderQty);
}

/**
 * 라인 출하수량 → 출하지시 상태.
 * - 전 라인 전량 출하: CLOSED
 * - 그 외(일부 출하·미출하·출하취소로 되돌아온 경우): CONFIRMED
 */
export function deriveShipOrderStatusFromLines(lines: ReadonlyArray<ShipOrderLineQty>): ShipOrderDerivedStatus {
  return isShipOrderFullyShipped(lines) ? 'CLOSED' : 'CONFIRMED';
}

/**
 * 출하반품/출하취소이력(SHIPMENT_RETURNS) 상태 집합.
 * 공통코드 그룹이 아직 없어 엔티티 문서(DRAFT → CONFIRMED → CLOSED)를 정본으로 둔다.
 * 출하취소 시 자동 생성되는 취소이력은 생성 즉시 종결이므로 CLOSED 로 기록한다.
 */
export const SHIP_RETURN_STATUSES = ['DRAFT', 'CONFIRMED', 'CLOSED'] as const;
export type ShipReturnStatus = (typeof SHIP_RETURN_STATUSES)[number];
export const SHIP_RETURN_STATUS_CLOSED: ShipReturnStatus = 'CLOSED';
