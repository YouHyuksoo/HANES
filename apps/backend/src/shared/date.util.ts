/**
 * @file src/shared/date.util.ts
 * @description 'YYYY-MM-DD' 날짜 문자열을 서버 로컬 기준 Date로 안전하게 파싱하는 유틸.
 *
 * 배경:
 * `new Date('2026-06-17')`은 UTC 자정으로 해석된다. 서버(Node) 프로세스 타임존에 따라
 * Oracle DATE 컬럼에 저장·비교될 때 날짜가 하루 밀릴 수 있다(off-by-one).
 * 날짜 전용(DATE) 값은 로컬 구성요소로 생성하여 날짜 정확성을 보장한다.
 */

/** 'YYYY-MM-DD'를 로컬 자정(00:00:00.000) Date로 파싱한다. (시작일/저장용) */
export function parseDateStart(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

/** 'YYYY-MM-DD'를 로컬 그날 끝(23:59:59.999) Date로 파싱한다. (종료일 포함 비교용) */
export function parseDateEnd(value?: string | null): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return new Date(value);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999);
}
