/**
 * @file src/components/data-grid/dateFilterFn.ts
 * @description 날짜 컬럼 기간 필터를 위한 타입 정의 및 커스텀 TanStack Table FilterFn
 *
 * 초보자 가이드:
 * 1. **DateFilterValue**: 시작일(from) ~ 종료일(to) 기간 범위
 * 2. **dateRangeFilterFn**: TanStack Table에 등록하여 날짜 필터링을 수행하는 함수
 * 3. DataGrid에서 `filterFns: { dateRange: dateRangeFilterFn }` 으로 등록
 * 4. 날짜 문자열을 비교 가능한 형태(YYYY-MM-DD)로 정규화하여 비교
 */
import type { FilterFn } from "@tanstack/react-table";

/** 날짜 필터 전체 값 (시작일 ~ 종료일) */
export interface DateFilterValue {
  /** 시작일 (YYYY-MM-DD) — null이면 제한 없음 */
  from: string | null;
  /** 종료일 (YYYY-MM-DD) — null이면 제한 없음 */
  to: string | null;
}

/** 빈 초기 필터 값 */
export const EMPTY_DATE_FILTER: DateFilterValue = {
  from: null,
  to: null,
};

/**
 * 셀 값에서 날짜 문자열(YYYY-MM-DD)을 추출
 * - ISO 문자열 "2026-02-24T12:00:00Z" → "2026-02-24"
 * - 날짜 문자열 "2026-02-24" → 그대로
 * - Date 객체 → toISOString().slice(0, 10)
 */
function extractDateStr(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  const str = String(raw);
  // YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm:ss 형식에서 앞 10자 추출
  const match = str.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

/**
 * 커스텀 날짜 기간 FilterFn — TanStack Table에 등록하여 사용
 *
 * from <= 셀날짜 <= to 범위 필터링
 */
export const dateRangeFilterFn: FilterFn<unknown> = (row, columnId, filterValue: DateFilterValue) => {
  const raw = row.getValue(columnId);
  const cellDate = extractDateStr(raw);

  // 셀에 날짜가 없으면 필터 통과 안 함
  if (!cellDate) return false;

  if (filterValue.from && cellDate < filterValue.from) return false;
  if (filterValue.to && cellDate > filterValue.to) return false;

  return true;
};

/** autoRemove: 빈 필터면 자동 제거 */
dateRangeFilterFn.autoRemove = (val: DateFilterValue | undefined) => {
  if (!val) return true;
  return !val.from && !val.to;
};
