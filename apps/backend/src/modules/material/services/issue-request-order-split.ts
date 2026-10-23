/**
 * @file src/modules/material/services/issue-request-order-split.ts
 * @description 묶음 출고요청의 작업지시별 수량 계산(순수 함수) — 요청 산출·출고 배분·스캔 배분이 같은 규칙을 쓴다.
 *
 * 초보자 가이드:
 * 1. 작업지시 순서는 항상 계획일 빠른 순 → 작업지시번호 순(sortOrdersByPlan)이다.
 * 2. splitRequestQtyByOrder: BOM 필요량(소요-기출고)에서 현장재고를 품목당 한 번만 빼고, 빠른 작업지시부터 덮는다.
 *    작업지시별로 현장재고를 따로 빼면 같은 재고가 N번 차감되므로 반드시 합계 단위로 계산한다.
 * 3. distributeQtyToOrders: 출고 수량을 빠른 작업지시의 잔여부터 채우고, 포장단위 올림 초과분은 마지막 작업지시에 둔다.
 *    그래서 품목 출고수량 = 작업지시별 출고수량 합계가 항상 성립한다.
 *    preferOrderNo(스캔 출고에서 찍은 작업지시)가 있으면 그 작업지시를 맨 앞에 둔다 — MAT_ISSUES.ORDER_NO 와 맞추기 위해.
 */

export interface PlanOrderKey {
  orderNo: string;
  /** 작업지시 계획일(없으면 맨 뒤) */
  planDate?: Date | string | null;
}

function planTime(value: PlanOrderKey['planDate']): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

/** 계획일 빠른 순 → 작업지시번호 순(원본 배열은 바꾸지 않는다) */
export function sortOrdersByPlan<T extends PlanOrderKey>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const diff = planTime(a.planDate) - planTime(b.planDate);
    if (diff !== 0) return diff;
    return a.orderNo.localeCompare(b.orderNo);
  });
}

export interface OrderNeed extends PlanOrderKey {
  /** BOM 소요량 - 기출고량(음수면 0 으로 본다) */
  needQty: number;
}

export interface OrderRequestQty {
  orderNo: string;
  requestQty: number;
}

/**
 * 품목 1개에 대한 작업지시별 요청수량(정수).
 * 현장재고는 빠른 작업지시부터 덮고, 정수화는 누적 올림 차이로 해서 합계 = ceil(전체 필요 - 현장재고) 가 된다.
 * 작업지시 1건이면 기존 1:1 산식 max(ceil(소요 - 기출고 - 현장재고), 0) 과 같다.
 */
export function splitRequestQtyByOrder(orders: readonly OrderNeed[], floorStockQty: number): OrderRequestQty[] {
  let floorLeft = Math.max(floorStockQty, 0);
  let cumulative = 0;
  let prevCeil = 0;
  return sortOrdersByPlan(orders).map((order) => {
    const need = Math.max(order.needQty, 0);
    const covered = Math.min(floorLeft, need);
    floorLeft -= covered;
    cumulative += need - covered;
    // 부동소수 오차로 0.0000001 이 1로 올라가지 않도록 소수 6자리에서 정리 후 올림
    const ceil = Math.ceil(Math.round(cumulative * 1e6) / 1e6);
    const requestQty = ceil - prevCeil;
    prevCeil = ceil;
    return { orderNo: order.orderNo, requestQty };
  });
}

export interface OrderIssueRow extends PlanOrderKey {
  requestQty: number;
  issuedQty: number;
}

export interface OrderIssueTake {
  orderNo: string;
  qty: number;
}

/**
 * 출고 수량을 작업지시별로 나눈다: 빠른 작업지시의 잔여(요청-출고)부터 채우고, 남는 수량(포장단위 올림 초과)은
 * 마지막 작업지시에 얹는다. 같은 작업지시는 한 항목으로 합친다. 행이 없으면 빈 배열.
 */
export function distributeQtyToOrders(rows: readonly OrderIssueRow[], qty: number, preferOrderNo?: string | null): OrderIssueTake[] {
  if (qty <= 0 || rows.length === 0) return [];
  const planSorted = sortOrdersByPlan(rows);
  const sorted = preferOrderNo
    ? [...planSorted.filter((row) => row.orderNo === preferOrderNo), ...planSorted.filter((row) => row.orderNo !== preferOrderNo)]
    : planSorted;
  const takes = new Map<string, number>();
  let remaining = qty;
  for (const row of sorted) {
    if (remaining <= 0) break;
    const open = Math.max(row.requestQty - row.issuedQty, 0);
    const take = Math.min(open, remaining);
    if (take > 0) {
      takes.set(row.orderNo, (takes.get(row.orderNo) ?? 0) + take);
      remaining -= take;
    }
  }
  if (remaining > 0) {
    const last = sorted[sorted.length - 1].orderNo;
    takes.set(last, (takes.get(last) ?? 0) + remaining);
  }
  return sorted
    .filter((row) => takes.has(row.orderNo))
    .map((row) => ({ orderNo: row.orderNo, qty: takes.get(row.orderNo)! }))
    .filter((take, idx, arr) => arr.findIndex((other) => other.orderNo === take.orderNo) === idx);
}
