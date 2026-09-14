import { calcStorageDays, isLongStored, LONG_STOCK_DEFAULT_DAYS, resolveLongStockDays } from './product-storage.rules';

describe('product-storage.rules', () => {
  const today = new Date(2026, 8, 14, 10, 30);

  describe('calcStorageDays', () => {
    it('발행일부터 오늘까지의 경과일을 센다', () => {
      expect(calcStorageDays(new Date(2026, 5, 28), today)).toBe(78);
      expect(calcStorageDays(new Date(2026, 8, 13), today)).toBe(1);
      expect(calcStorageDays(new Date(2026, 8, 14), today)).toBe(0);
    });

    it('시각이 달라도 날짜 단위로만 센다(오늘 오전/오후 무관)', () => {
      expect(calcStorageDays(new Date(2026, 8, 13, 23, 59), today)).toBe(1);
      expect(calcStorageDays(new Date(2026, 8, 13, 0, 1), today)).toBe(1);
    });

    it('문자열 날짜도 로컬 기준으로 해석한다(UTC 변환 금지)', () => {
      expect(calcStorageDays('2026-06-28', today)).toBe(78);
    });

    it('발행일이 없으면 null', () => {
      expect(calcStorageDays(null, today)).toBeNull();
      expect(calcStorageDays(undefined, today)).toBeNull();
    });

    it('미래 발행일은 0으로 막는다(음수 경과일 금지)', () => {
      expect(calcStorageDays(new Date(2026, 8, 20), today)).toBe(0);
    });
  });

  describe('resolveLongStockDays', () => {
    it('설정값 문자열을 숫자로 읽는다', () => {
      expect(resolveLongStockDays('90')).toBe(90);
      expect(resolveLongStockDays('30')).toBe(30);
    });

    it('값이 없거나 숫자가 아니거나 0 이하면 기본값 90을 쓴다', () => {
      expect(resolveLongStockDays(null)).toBe(LONG_STOCK_DEFAULT_DAYS);
      expect(resolveLongStockDays('')).toBe(LONG_STOCK_DEFAULT_DAYS);
      expect(resolveLongStockDays('abc')).toBe(LONG_STOCK_DEFAULT_DAYS);
      expect(resolveLongStockDays('0')).toBe(LONG_STOCK_DEFAULT_DAYS);
      expect(resolveLongStockDays('-5')).toBe(LONG_STOCK_DEFAULT_DAYS);
    });
  });

  describe('isLongStored', () => {
    it('기준일수를 넘기면 장기보관이다(초과 기준, 같은 날은 아님)', () => {
      expect(isLongStored(new Date(2026, 5, 15), 90, today)).toBe(true); // 91일 → 초과
      expect(isLongStored(new Date(2026, 5, 15, 12), 90, today)).toBe(true);
      expect(isLongStored(new Date(2026, 5, 16), 90, today)).toBe(false); // 정확히 90일 → 경계는 아직 아님
      expect(isLongStored(new Date(2026, 5, 17), 90, today)).toBe(false); // 89일
    });

    it('발행일이 없으면 판정하지 않는다', () => {
      expect(isLongStored(null, 90, today)).toBe(false);
    });

    it('기준일수가 유효하지 않으면 기본값 90으로 판정한다', () => {
      expect(isLongStored(new Date(2026, 0, 1), 0, today)).toBe(true);
    });
  });
});
