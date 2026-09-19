/**
 * @file components/shared/carrier/formatDateTime.ts
 * @description 대차 화면 공용 날짜시간 포맷 — 서버 ISO 타임스탬프를 "YYYY-MM-DD HH:mm:ss"로 자른다.
 *              @/utils/date 에는 date-only 포맷(formatDateOnly)만 있어 대차 관련 화면 3곳(전표 인쇄, 컬럼, 상세 패널)이
 *              각자 로컬 정의를 쓰던 것을 이 파일 하나로 통일한다.
 */
export function formatCarrierDateTime(v?: string | null): string {
  return v ? String(v).replace("T", " ").slice(0, 19) : "-";
}
