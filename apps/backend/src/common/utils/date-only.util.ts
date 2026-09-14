/**
 * @file common/utils/date-only.util.ts
 * @description 엔티티 `type: 'date'` 컬럼 값을 'YYYY-MM-DD' 로 만든다.
 *
 * 초보자 가이드:
 * 1. TypeORM 의 `type: 'date'` 컬럼은 프로퍼티 타입을 `Date` 로 선언해도 Oracle 하이드레이션 결과가
 *    **'YYYY-MM-DD' 문자열**이다. `.toISOString()`, `.getFullYear()` 를 바로 부르면 런타임에 죽는다
 *    (출하 일별 통계 500, 수리 시작 500 이 이것이었다).
 * 2. 그래서 date 컬럼 값을 날짜 문자열로 쓸 때는 항상 이 함수를 거친다 — Date 든 문자열이든 받는다.
 * 3. Date 는 **로컬 날짜** 기준이다. `toISOString().slice(0,10)` 은 UTC 라 KST 오전엔 전날이 된다.
 */
export function toDateOnly(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : formatLocal(parsed);
  }
  return Number.isNaN(value.getTime()) ? null : formatLocal(value);
}

function formatLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
