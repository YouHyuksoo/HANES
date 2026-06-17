/**
 * @file src/utils/date.ts
 * @description 로컬(브라우저) 타임존 기준 날짜 문자열 유틸.
 *
 * 배경:
 * `new Date().toISOString().slice(0, 10)`은 UTC 기준이라 KST(UTC+9) 새벽~오전(00:00~08:59)에
 * 전날을 반환한다. 이 값을 날짜 입력 기본값/오늘 계산에 쓰면 off-by-one으로 날짜가 하루 밀려
 * 저장된다(예: PO 일자를 오늘로 입력해도 ORDER_DATE가 어제로 저장).
 *
 * 주의: 이미 서버에서 받은 ISO 문자열을 표시용으로 자르는 `value.slice(0, 10)`은 이 문제와
 * 무관하므로 그대로 둔다. 이 유틸은 "지금/오늘"을 로컬 기준으로 계산할 때만 사용한다.
 */

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
