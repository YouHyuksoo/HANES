/**
 * @file src/utils/date.ts
 * @description 날짜 전용 업무값과 로컬 오늘 문자열 유틸.
 *
 * 배경:
 * new Date()를 UTC 변환 후 slice하는 방식은 설치/사용 지역의 오전 시간대에서 전날을 반환할 수 있다.
 * 이 값을 날짜 입력 기본값/오늘 계산에 쓰면 off-by-one으로 날짜가 하루 밀려 저장된다.
 *
 * API는 날짜 전용 업무값을 가능하면 'YYYY-MM-DD' 문자열로 내려줘야 한다.
 * 이 유틸은 프론트에서 날짜 입력 기본값 또는 Date 객체 fallback을 로컬 기준으로 다룰 때 사용한다.
 */

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 주어진 날짜(기본: 현재)를 로컬 타임존 기준 'YYYY-MM-DD' 문자열로 반환한다.
 * @param date 변환할 Date (생략 시 현재 시각)
 */
export function getTodayLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 날짜 전용 업무값을 로컬 기준 'YYYY-MM-DD'로 반환한다.
 * 서버가 날짜 전용 값을 내려줄 때는 timezone이 섞인 ISO가 아니라 'YYYY-MM-DD'를 내려주는 것이 원칙이다.
 */
export function formatDateOnly(value?: string | Date | null, fallback = ''): string {
  if (!value) return fallback;

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return fallback;
    if (DATE_ONLY_RE.test(text)) return text;

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return getTodayLocal(parsed);
  }

  if (Number.isNaN(value.getTime())) return fallback;
  return getTodayLocal(value);
}

/** 'YYYY-MM-DD' 시작/종료 범위 */
export interface DateRange {
  from: string;
  to: string;
}

/** 기본 조회 범위: 오늘 ~ 오늘 */
export function getDefaultRange(): DateRange {
  const today = getTodayLocal();
  return { from: today, to: today };
}

/** 최근 N일: (오늘 - (N-1)) ~ 오늘 */
export function getRecentDaysRange(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: getTodayLocal(from), to: getTodayLocal(to) };
}

/** 이번 달: 1일 ~ 오늘 */
export function getThisMonthRange(): DateRange {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: getTodayLocal(first), to: getTodayLocal(now) };
}
