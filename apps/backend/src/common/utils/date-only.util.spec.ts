import { toDateOnly } from './date-only.util';

describe('toDateOnly', () => {
  it("Oracle 'date' 컬럼 하이드레이션 값(YYYY-MM-DD 문자열)을 그대로 돌려준다", () => {
    expect(toDateOnly('2026-07-05')).toBe('2026-07-05');
  });

  it('Date 는 로컬 날짜로 만든다 — UTC 변환으로 전날이 되지 않는다', () => {
    expect(toDateOnly(new Date(2026, 6, 5, 8, 0))).toBe('2026-07-05');
    expect(toDateOnly(new Date(2026, 6, 5, 23, 59))).toBe('2026-07-05');
  });

  it('ISO 문자열은 로컬 날짜로 바꾼다', () => {
    expect(toDateOnly(new Date(2026, 6, 5, 9).toISOString())).toBe('2026-07-05');
  });

  it('null/undefined/빈문자열/해석불가는 null', () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly(undefined)).toBeNull();
    expect(toDateOnly('')).toBeNull();
    expect(toDateOnly('not-a-date')).toBeNull();
    expect(toDateOnly(new Date('x'))).toBeNull();
  });
});
