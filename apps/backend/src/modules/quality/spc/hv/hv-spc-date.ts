/**
 * @file hv-spc-date.ts
 * @description HV SPC 날짜 유틸 — 목업/DB 소스와 서비스가 공유한다.
 *
 * 초보자 가이드:
 * - UTC 변환 금지: `toISOString()` 은 KST 오전에 전날이 된다. 로컬 연/월/일로 직접 포맷한다.
 * - `dateRange(days)` 는 "오늘 포함 최근 N일" 의 시작/끝을 YYYY-MM-DD 로 돌려준다.
 */

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** YYYY-MM-DD (로컬) */
export function fmtDateLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** HH:mm (로컬) */
export function fmtTimeLocal(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 차트 x축 라벨 MM/DD */
export function fmtLabel(d: Date): string {
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

/** 오늘 포함 최근 N일의 시작일(00:00 로컬) */
export function rangeStart(days: number, today: Date = new Date()): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
}

/** 오늘 포함 최근 N일 구간 (YYYY-MM-DD) */
export function dateRange(days: number, today: Date = new Date()): { dateFrom: string; dateTo: string } {
  return { dateFrom: fmtDateLocal(rangeStart(days, today)), dateTo: fmtDateLocal(today) };
}
