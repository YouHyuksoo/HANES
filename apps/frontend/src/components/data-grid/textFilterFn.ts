/**
 * @file src/components/data-grid/textFilterFn.ts
 * @description 문자 컬럼 멀티 선택(IN) 필터를 위한 타입 정의 및 커스텀 FilterFn
 *
 * 초보자 가이드:
 * 1. **TextFilterValue**: 체크박스로 선택된 값 목록 (SQL의 IN 연산과 동일)
 * 2. **textInFilterFn**: TanStack Table에 등록하여 멀티 선택 필터링 수행
 * 3. DataGrid에서 `filterFns: { textIn: textInFilterFn }` 으로 등록
 * 4. `filterType: 'multi'` 를 meta에 지정하면 자동 연결
 */
import type { FilterFn } from "@tanstack/react-table";

/** 멀티 선택 필터 값 */
export interface TextFilterValue {
  /** 선택된 값 목록 — null이면 "전체 선택" (필터 미적용) */
  checkedValues: string[] | null;
}

/** 빈 초기 필터 값 */
export const EMPTY_TEXT_FILTER: TextFilterValue = {
  checkedValues: null,
};

/** 빈값 표시용 센티널 */
export const BLANK_TEXT = "__BLANK__";

/**
 * 커스텀 멀티 선택 FilterFn — 체크된 값 목록에 포함되는 행만 통과
 */
export const textInFilterFn: FilterFn<unknown> = (row, columnId, filterValue: TextFilterValue) => {
  if (filterValue.checkedValues === null) return true; // 전체 선택

  const raw = row.getValue(columnId);
  const cellVal = (raw == null || raw === "") ? BLANK_TEXT : String(raw);

  return filterValue.checkedValues.includes(cellVal);
};

/** autoRemove: 빈 필터면 자동 제거 */
textInFilterFn.autoRemove = (val: TextFilterValue | undefined) => {
  if (!val) return true;
  return val.checkedValues === null;
};
