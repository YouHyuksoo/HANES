import { BadRequestException } from '@nestjs/common';
import { repairDateOnly, repairDay, repairDayRange } from './repair-date';

describe('repair-date', () => {
  it('Date 를 로컬 기준 YYYY-MM-DD 로 만든다', () => {
    expect(repairDateOnly(new Date(2026, 8, 14, 23, 30))).toBe('2026-09-14');
  });

  it("Oracle 'date' 컬럼 하이드레이션 값(YYYY-MM-DD 문자열)을 그대로 통과시킨다", () => {
    // REPAIR_ORDERS.REPAIR_DATE 는 엔티티 타입이 Date 지만 런타임엔 문자열로 온다 — 예전엔 getFullYear 로 죽었다
    expect(repairDateOnly('2026-09-14')).toBe('2026-09-14');
  });

  it('ISO 문자열은 로컬 날짜로 바꾸고, 해석 불가 문자열은 실패한다', () => {
    const iso = new Date(2026, 8, 14, 9).toISOString();
    expect(repairDateOnly(iso)).toBe('2026-09-14');
    expect(() => repairDateOnly('not-a-date')).toThrow(BadRequestException);
  });

  it('repairDayRange 는 하루의 시작~끝을, repairDay 는 같은 범위의 BETWEEN 을 준다', () => {
    const [start, end] = repairDayRange('2026-09-14');
    expect(start).toEqual(new Date(2026, 8, 14));
    expect(end).toEqual(new Date(2026, 8, 14, 23, 59, 59, 999));
    expect(repairDay('2026-09-14').value).toEqual([start, end]);
    expect(() => repairDayRange('2026-02-30')).toThrow(BadRequestException);
  });
});
