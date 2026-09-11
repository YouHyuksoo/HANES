import { ceilQty, gtQty, ltQty, mulQty, roundQty } from '@harness/shared';

describe('qty-math (defect 17, 2026-09-09)', () => {
  it('mulQty removes float noise from BOM requirement multiplication', () => {
    expect(870 * 0.67).not.toBe(582.9); // 원래 float 결과는 582.9000000000001
    expect(mulQty(870, 0.67)).toBe(582.9);
    expect(mulQty(1000, 0.67)).toBe(670);
  });
  it('ltQty does not treat an exact remaining balance as insufficient', () => {
    expect(ltQty(582.9, 870 * 0.67)).toBe(false);
    expect(ltQty(582.8, 582.9)).toBe(true);
    expect(gtQty(870 * 0.67, 582.9)).toBe(false);
  });
  it('ceilQty avoids over-rounding float noise (7.000000000000001 → 8)', () => {
    expect(0.07 * 100).not.toBe(7); // 7.000000000000001
    expect(Math.ceil(0.07 * 100)).toBe(8);
    expect(ceilQty(0.07 * 100)).toBe(7);
    expect(ceilQty(670.4)).toBe(671);
  });
  it('roundQty is safe for NaN/Infinity', () => {
    expect(roundQty(Number.NaN)).toBe(0);
    expect(roundQty(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
