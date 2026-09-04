/**
 * @file product-stock-rules.spec.ts
 * @description 제품재고·제품수불 상태 규칙(@harness/shared product-stock-rules) — 공통코드 PRODUCT_HOLD_STATUS 정본 검증
 */
import {
  PRODUCT_STOCK_HOLD_STATUS,
  PRODUCT_QUALITY_STATUS,
  PRODUCT_TRANSACTION_STATUS,
  isProductStockOnHold,
  isProductTransactionCanceled,
  normalizeProductQualityStatus,
} from '@harness/shared';

describe('product-stock-rules', () => {
  it('PRODUCT_STOCKS.STATUS 정본은 공통코드 PRODUCT_HOLD_STATUS(NORMAL/HOLD)뿐이다', () => {
    expect(Object.values(PRODUCT_STOCK_HOLD_STATUS).sort()).toEqual(['HOLD', 'NORMAL']);
  });

  it('보류 판정은 HOLD만 참이고 NORMAL·라벨 어휘(IN_STOCK)·빈값은 거짓', () => {
    expect(isProductStockOnHold('HOLD')).toBe(true);
    expect(isProductStockOnHold('hold')).toBe(true);
    expect(isProductStockOnHold('NORMAL')).toBe(false);
    expect(isProductStockOnHold('IN_STOCK')).toBe(false);
    expect(isProductStockOnHold(null)).toBe(false);
  });

  it('품질 상태는 DEFECT 명시 외 모두 GOOD으로 정규화한다', () => {
    expect(PRODUCT_QUALITY_STATUS.GOOD).toBe('GOOD');
    expect(normalizeProductQualityStatus('DEFECT')).toBe('DEFECT');
    expect(normalizeProductQualityStatus('GOOD')).toBe('GOOD');
    expect(normalizeProductQualityStatus(undefined)).toBe('GOOD');
    expect(normalizeProductQualityStatus('IN_STOCK')).toBe('GOOD');
  });

  it('PRODUCT_TRANSACTIONS.STATUS는 DONE/CANCELED만 쓰고 취소 판정은 CANCELED만 참', () => {
    expect(Object.values(PRODUCT_TRANSACTION_STATUS).sort()).toEqual(['CANCELED', 'DONE']);
    expect(isProductTransactionCanceled('CANCELED')).toBe(true);
    expect(isProductTransactionCanceled('DONE')).toBe(false);
    expect(isProductTransactionCanceled(undefined)).toBe(false);
  });
});
