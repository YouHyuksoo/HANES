/**
 * @file packages/shared/src/utils/purchase-order-rules.ts
 * @description 구매발주(PURCHASE_ORDERS / PURCHASE_ORDER_ITEMS) 상태 규칙 — 입하(arrival)·입하취소·PO 수정/마감이 모두 이 한 곳을 쓴다.
 *
 * 정본 어휘(2026-09-04 COM_CODES 실측)
 * - PO_STATUS      : DRAFT(임시저장) / CONFIRMED(확정) / PARTIAL(부분입고) / RECEIVED(입고완료) / CLOSED(마감)
 * - PO_LINE_STATUS : OPEN(미입하) / PARTIAL(일부입하) / CLOSE(마감)
 *
 * DRAFT 와 CLOSED 는 사람이 정하는 상태(확정/마감 버튼), CONFIRMED·PARTIAL·RECEIVED 는 라인 입하수량에서 파생되는 상태다.
 */

/** COM_CODES.PO_STATUS 정본 집합 */
export const PO_STATUSES = ['DRAFT', 'CONFIRMED', 'PARTIAL', 'RECEIVED', 'CLOSED'] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];

/** COM_CODES.PO_LINE_STATUS 정본 집합 */
export const PO_LINE_STATUSES = ['OPEN', 'PARTIAL', 'CLOSE'] as const;
export type PurchaseOrderLineStatus = (typeof PO_LINE_STATUSES)[number];

/** 입하를 받을 수 있는 헤더 상태 */
export const PO_RECEIVABLE_STATUSES = ['CONFIRMED', 'PARTIAL'] as const;

/** 사용자가 마감(CLOSED) 버튼을 누를 수 있는 헤더 상태 — 부분입고 상태의 단축 마감을 허용한다 */
export const PO_CLOSABLE_STATUSES = ['PARTIAL', 'RECEIVED'] as const;

export function isPurchaseOrderReceivable(status: string | null | undefined): boolean {
  return (PO_RECEIVABLE_STATUSES as readonly string[]).includes(String(status ?? '').toUpperCase());
}

export function isPurchaseOrderClosable(status: string | null | undefined): boolean {
  return (PO_CLOSABLE_STATUSES as readonly string[]).includes(String(status ?? '').toUpperCase());
}

export interface PurchaseOrderLineQty {
  /** 발주수량 */
  orderQty: number;
  /** 입하 누계(이번 처리분을 반영한 값). null 은 0 으로 본다 */
  receivedQty: number | null;
}

/**
 * 라인 입하수량 → 라인 상태.
 * - 입하 0: OPEN
 * - 발주수량 이상: CLOSE
 * - 그 외: PARTIAL
 */
export function derivePurchaseOrderLineStatus({ orderQty, receivedQty }: PurchaseOrderLineQty): PurchaseOrderLineStatus {
  const received = receivedQty ?? 0;
  if (received <= 0) return 'OPEN';
  if (received >= orderQty) return 'CLOSE';
  return 'PARTIAL';
}

/** 라인에서 파생되는 헤더 상태(사람이 정하는 DRAFT/CLOSED 는 제외) */
export type PurchaseOrderDerivedStatus = 'CONFIRMED' | 'PARTIAL' | 'RECEIVED';

/**
 * 라인 입하수량 → 헤더 상태.
 * - 라인 0건: CONFIRMED (입하할 것이 없으면 입고완료가 아니다)
 * - 전 라인 발주수량 이상 입하: RECEIVED
 * - 한 라인이라도 입하: PARTIAL
 * - 입하 없음(입하취소로 전부 되돌아온 경우 포함): CONFIRMED
 */
export function derivePurchaseOrderStatusFromLines(lines: ReadonlyArray<PurchaseOrderLineQty>): PurchaseOrderDerivedStatus {
  if (lines.length === 0) return 'CONFIRMED';
  const statuses = lines.map(derivePurchaseOrderLineStatus);
  if (statuses.every((s) => s === 'CLOSE')) return 'RECEIVED';
  if (statuses.some((s) => s !== 'OPEN')) return 'PARTIAL';
  return 'CONFIRMED';
}

/**
 * 입하/입하취소 반영으로 헤더 상태를 자동 전이해도 되는가.
 * DRAFT(미확정)·CLOSED(마감)는 사람이 정한 상태라 라인 수량이 바꾸지 않는다.
 * 마감된 PO 의 입하를 취소해도 PARTIAL 로 되살아나지 않는다(마감 우회 방지).
 */
export function canAutoTransitionPurchaseOrder(status: string | null | undefined): boolean {
  const s = String(status ?? '').toUpperCase();
  return s !== 'DRAFT' && s !== 'CLOSED';
}
