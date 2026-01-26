/**
 * @file packages/shared/src/utils/date.ts
 * @description 날짜 관련 유틸리티 함수
 *
 * 초보자 가이드:
 * 1. **formatDate()**: 날짜를 원하는 형식의 문자열로 변환
 * 2. **getDatePrefix()**: LOT 번호 등에 사용할 날짜 접두사 생성
 * 3. **parseDate()**: 문자열을 Date 객체로 변환
 */

/**
 * 날짜를 지정된 형식의 문자열로 변환
 * @param date 날짜 (Date 객체 또는 문자열)
 * @param format 형식 (기본값: 'YYYY-MM-DD')
 * @returns 형식화된 날짜 문자열
 *
 * @example
 * formatDate(new Date(), 'YYYY-MM-DD')         // '2024-01-15'
 * formatDate(new Date(), 'YYYY-MM-DD HH:mm')   // '2024-01-15 09:30'
 * formatDate(new Date(), 'YYYY년 MM월 DD일')   // '2024년 01월 15일'
 */
export function formatDate(
  date: Date | string | null | undefined,
  format: string = 'YYYY-MM-DD'
): string {
  if (!date) return '';

  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * 날짜 접두사 생성 (YYYYMMDD 형식)
 * @param date 날짜 (기본값: 현재 날짜)
 * @returns YYYYMMDD 형식의 문자열
 *
 * @example
 * getDatePrefix()                    // '20240115'
 * getDatePrefix(new Date(2024, 0, 1)) // '20240101'
 */
export function getDatePrefix(date: Date = new Date()): string {
  return formatDate(date, 'YYYYMMDD');
}

/**
 * 날짜+시간 접두사 생성 (YYYYMMDDHHmmss 형식)
 * @param date 날짜 (기본값: 현재 날짜)
 * @returns YYYYMMDDHHmmss 형식의 문자열
 *
 * @example
 * getDateTimePrefix() // '20240115093045'
 */
export function getDateTimePrefix(date: Date = new Date()): string {
  return formatDate(date, 'YYYYMMDDHHmmss');
}

/**
 * 날짜 문자열을 Date 객체로 변환
 * @param dateStr 날짜 문자열
 * @returns Date 객체 또는 null
 */
export function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 오늘 날짜인지 확인
 * @param date 확인할 날짜
 * @returns 오늘이면 true
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();

  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

/**
 * 두 날짜 사이의 일수 계산
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @returns 일수 차이
 */
export function daysBetween(startDate: Date | string, endDate: Date | string): number {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 날짜에 일수 더하기
 * @param date 기준 날짜
 * @param days 더할 일수 (음수면 빼기)
 * @returns 새로운 Date 객체
 */
export function addDays(date: Date | string, days: number): Date {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * 해당 월의 첫째 날 반환
 * @param date 기준 날짜
 * @returns 해당 월의 1일
 */
export function getFirstDayOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * 해당 월의 마지막 날 반환
 * @param date 기준 날짜
 * @returns 해당 월의 마지막 날
 */
export function getLastDayOfMonth(date: Date = new Date()): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/**
 * 해당 주의 시작일 반환 (월요일 기준)
 * @param date 기준 날짜
 * @returns 해당 주의 월요일
 */
export function getStartOfWeek(date: Date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

/**
 * 근무 시간(교대) 코드 반환
 * @param date 시간 (기본값: 현재)
 * @returns 교대 코드 (DAY, SWING, NIGHT)
 *
 * @example
 * // 오전 9시 -> 'DAY'
 * // 오후 4시 -> 'SWING'
 * // 밤 12시 -> 'NIGHT'
 */
export function getShiftCode(date: Date = new Date()): 'DAY' | 'SWING' | 'NIGHT' {
  const hour = date.getHours();

  if (hour >= 6 && hour < 14) return 'DAY';
  if (hour >= 14 && hour < 22) return 'SWING';
  return 'NIGHT';
}

/**
 * 작업일 기준 날짜 반환 (야간근무 시 전날로 처리)
 * @param date 기준 시간
 * @returns 작업일 Date
 */
export function getWorkDate(date: Date = new Date()): Date {
  const hour = date.getHours();

  // 새벽 0시 ~ 6시는 전날로 처리
  if (hour < 6) {
    return addDays(date, -1);
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * 시간 차이를 사람이 읽기 쉬운 형태로 반환
 * @param date 비교 날짜
 * @param lang 언어 코드
 * @returns '방금 전', '5분 전', '2시간 전' 등
 */
export function getRelativeTime(
  date: Date | string,
  lang: 'ko' | 'en' | 'vi' = 'ko'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const labels = {
    ko: {
      justNow: '방금 전',
      minute: '분 전',
      hour: '시간 전',
      day: '일 전',
    },
    en: {
      justNow: 'just now',
      minute: ' min ago',
      hour: ' hours ago',
      day: ' days ago',
    },
    vi: {
      justNow: 'vừa xong',
      minute: ' phút trước',
      hour: ' giờ trước',
      day: ' ngày trước',
    },
  };

  const l = labels[lang];

  if (diffSec < 60) return l.justNow;
  if (diffMin < 60) return `${diffMin}${l.minute}`;
  if (diffHour < 24) return `${diffHour}${l.hour}`;
  return `${diffDay}${l.day}`;
}
