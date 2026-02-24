/**
 * @file src/components/data-grid/numberFilterFn.ts
 * @description 숫자 컬럼 범위 필터를 위한 타입 정의 및 커스텀 TanStack Table FilterFn
 *
 * 초보자 가이드:
 * 1. **NumberOperator**: 비교 연산자 (초과, 이상, 미만, 이하, 같음, 다름, 빈값, 비빈값)
 * 2. **NumberFilterValue**: 체크박스 선택값 + 범위 조건 2개 + And/Or 연결자
 * 3. **numberRangeFilterFn**: TanStack Table에 등록하여 숫자 필터링을 수행하는 함수
 * 4. DataGrid에서 `filterFns: { numberRange: numberRangeFilterFn }` 으로 등록
 */
import type { FilterFn } from "@tanstack/react-table";

/** 숫자 필터 비교 연산자 */
export type NumberOperator =
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "eq"
  | "neq"
  | "blank"
  | "notBlank"
  | "none";

/** 개별 범위 조건 */
export interface NumberCondition {
  operator: NumberOperator;
  value: number | null;
}

/** 숫자 필터 전체 값 (체크박스 + 범위 조건) */
export interface NumberFilterValue {
  /** 선택된 고유값 목록 — null이면 "전체 선택" (필터 미적용) */
  checkedValues: number[] | null;
  condition1: NumberCondition;
  connector: "and" | "or";
  condition2: NumberCondition;
}

/** 빈 초기 필터 값 */
export const EMPTY_NUMBER_FILTER: NumberFilterValue = {
  checkedValues: null,
  condition1: { operator: "none", value: null },
  connector: "and",
  condition2: { operator: "none", value: null },
};

/** 단일 조건 평가 */
function evaluateCondition(cellVal: number | null, cond: NumberCondition): boolean | null {
  const { operator, value } = cond;
  if (operator === "none") return null; // 조건 없음 → 무시
  if (operator === "blank") return cellVal == null || isNaN(cellVal);
  if (operator === "notBlank") return cellVal != null && !isNaN(cellVal);
  if (cellVal == null || isNaN(cellVal) || value == null) return false;

  switch (operator) {
    case "gt": return cellVal > value;
    case "gte": return cellVal >= value;
    case "lt": return cellVal < value;
    case "lte": return cellVal <= value;
    case "eq": return cellVal === value;
    case "neq": return cellVal !== value;
    default: return null;
  }
}

/**
 * 커스텀 숫자 범위 FilterFn — TanStack Table에 등록하여 사용
 *
 * 평가 순서:
 * 1. 체크박스 필터 (checkedValues) 적용
 * 2. 범위 조건 (condition1 And/Or condition2) 적용
 * 3. 두 결과를 AND 결합 (체크박스 통과 && 범위 통과)
 */
export const numberRangeFilterFn: FilterFn<unknown> = (row, columnId, filterValue: NumberFilterValue) => {
  const raw = row.getValue(columnId);
  const cellVal = raw == null ? null : Number(raw);

  // 1) 체크박스 필터
  if (filterValue.checkedValues !== null) {
    const isBlankCell = cellVal == null || isNaN(cellVal);
    const checkedHasBlank = filterValue.checkedValues.some((v) => isNaN(v));
    if (isBlankCell) {
      if (!checkedHasBlank) return false;
    } else {
      if (!filterValue.checkedValues.includes(cellVal!)) return false;
    }
  }

  // 2) 범위 조건
  const r1 = evaluateCondition(cellVal == null ? null : (isNaN(cellVal) ? null : cellVal), filterValue.condition1);
  const r2 = evaluateCondition(cellVal == null ? null : (isNaN(cellVal) ? null : cellVal), filterValue.condition2);

  if (r1 !== null && r2 !== null) {
    return filterValue.connector === "and" ? (r1 && r2) : (r1 || r2);
  }
  if (r1 !== null) return r1;
  if (r2 !== null) return r2;

  return true; // 조건 없으면 통과
};

/** autoRemove: 빈 필터면 자동 제거 */
numberRangeFilterFn.autoRemove = (val: NumberFilterValue | undefined) => {
  if (!val) return true;
  const noChecked = val.checkedValues === null;
  const noCond1 = val.condition1.operator === "none";
  const noCond2 = val.condition2.operator === "none";
  return noChecked && noCond1 && noCond2;
};
