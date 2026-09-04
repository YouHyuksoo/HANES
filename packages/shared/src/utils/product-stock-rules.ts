/**
 * @file packages/shared/src/utils/product-stock-rules.ts
 * @description 제품재고(PRODUCT_STOCKS)·제품수불(PRODUCT_TRANSACTIONS) 상태 규칙.
 *              - PRODUCT_STOCKS.STATUS 정본 = 공통코드 PRODUCT_HOLD_STATUS(NORMAL/HOLD). 보류/해제와 출고 가드가 함께 쓴다.
 *              - PRODUCT_STOCKS.QUALITY_STATUS = GOOD/DEFECT (복합 PK 구성요소). 불량은 같은 창고에 있어도 후공정 투입 대상에서 제외.
 *              - PRODUCT_TRANSACTIONS.STATUS = DONE/CANCELED (삭제 금지, 취소 시 원본 CANCELED + 역분개 DONE).
 *              시리얼 추적 라벨(SG_LABELS IN_STOCK/MOUNTED/CONSUMED/DEFECT, FG_LABELS)은 별도 엔티티 어휘라 여기 두지 않는다.
 */

/** 공통코드 PRODUCT_HOLD_STATUS 정본 값 — PRODUCT_STOCKS.STATUS */
export const PRODUCT_STOCK_HOLD_STATUS = {
  NORMAL: 'NORMAL',
  HOLD: 'HOLD',
} as const;

export type ProductStockHoldStatus = (typeof PRODUCT_STOCK_HOLD_STATUS)[keyof typeof PRODUCT_STOCK_HOLD_STATUS];

/** 보류(HOLD) 중인 제품재고인가 — 출고/이동 가드와 보류 해제 전제조건이 같은 판정을 쓴다 */
export function isProductStockOnHold(status: string | null | undefined): boolean {
  return String(status ?? '').toUpperCase() === PRODUCT_STOCK_HOLD_STATUS.HOLD;
}

/** PRODUCT_STOCKS.QUALITY_STATUS 값 */
export const PRODUCT_QUALITY_STATUS = {
  GOOD: 'GOOD',
  DEFECT: 'DEFECT',
} as const;

export type ProductQualityStatus = (typeof PRODUCT_QUALITY_STATUS)[keyof typeof PRODUCT_QUALITY_STATUS];

/** 품질 상태 정규화 — DEFECT 명시 외에는 모두 GOOD(복합 PK 기본값) */
export function normalizeProductQualityStatus(value: string | null | undefined): ProductQualityStatus {
  return value === PRODUCT_QUALITY_STATUS.DEFECT ? PRODUCT_QUALITY_STATUS.DEFECT : PRODUCT_QUALITY_STATUS.GOOD;
}

/** PRODUCT_TRANSACTIONS.STATUS 값 — 공통코드 그룹 없음(엔티티 기본값 DONE, 실DB DONE/CANCELED만 존재) */
export const PRODUCT_TRANSACTION_STATUS = {
  DONE: 'DONE',
  CANCELED: 'CANCELED',
} as const;

export type ProductTransactionStatus = (typeof PRODUCT_TRANSACTION_STATUS)[keyof typeof PRODUCT_TRANSACTION_STATUS];

/** 이미 취소된 수불인가 — 이중 취소 가드 */
export function isProductTransactionCanceled(status: string | null | undefined): boolean {
  return String(status ?? '').toUpperCase() === PRODUCT_TRANSACTION_STATUS.CANCELED;
}
