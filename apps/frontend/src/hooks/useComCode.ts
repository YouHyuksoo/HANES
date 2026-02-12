/**
 * @file src/hooks/useComCode.ts
 * @description 공통코드 조회 훅 - DB 기반 상태/유형 코드를 프론트엔드에서 사용
 *
 * 초보자 가이드:
 * 1. **useComCodes()**: 전체 공통코드를 한 번에 로드 (staleTime 5분)
 * 2. **useComCodeOptions(groupCode)**: Select 드롭다운용 options 배열 반환
 * 3. **useComCodeLabel(groupCode, detailCode)**: 해당 코드의 한국어 라벨
 * 4. **useComCodeColor(groupCode, detailCode)**: Tailwind 색상 클래스
 * 5. **useComCodeItem(groupCode, detailCode)**: 전체 코드 항목
 */

import { useMemo } from "react";
import { useApiQuery } from "./useApi";

export interface ComCodeItem {
  detailCode: string;
  codeName: string;
  codeDesc: string | null;
  sortOrder: number;
  attr1: string | null;
  attr2: string | null;
  attr3: string | null;
}

export type ComCodeMap = Record<string, ComCodeItem[]>;

const COM_CODE_QUERY_KEY = ["com-codes", "all-active"];
const COM_CODE_URL = "/v1/master/com-codes/all-active";

const DEFAULT_COLOR =
  "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

export function useComCodes() {
  return useApiQuery<ComCodeMap>(COM_CODE_QUERY_KEY, COM_CODE_URL, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useComCodeOptions(
  groupCode: string,
  includeAll: boolean = false,
) {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const options = codes.map((c: ComCodeItem) => ({
      value: c.detailCode,
      label: c.codeName,
    }));
    if (includeAll) {
      return [{ value: "", label: "전체" }, ...options];
    }
    return options;
  }, [data, groupCode, includeAll]);
}

export function useComCodeLabel(
  groupCode: string,
  detailCode: string,
): string {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const found = codes.find(
      (c: ComCodeItem) => c.detailCode === detailCode,
    );
    return found?.codeName ?? detailCode;
  }, [data, groupCode, detailCode]);
}

export function useComCodeColor(
  groupCode: string,
  detailCode: string,
): string {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const found = codes.find(
      (c: ComCodeItem) => c.detailCode === detailCode,
    );
    return found?.attr1 ?? DEFAULT_COLOR;
  }, [data, groupCode, detailCode]);
}

export function useComCodeItem(
  groupCode: string,
  detailCode: string,
): ComCodeItem | null {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    return (
      codes.find((c: ComCodeItem) => c.detailCode === detailCode) ?? null
    );
  }, [data, groupCode, detailCode]);
}

export function useComCodeList(groupCode: string): ComCodeItem[] {
  const { data } = useComCodes();
  return useMemo(() => {
    return data?.data?.[groupCode] ?? [];
  }, [data, groupCode]);
}

export function useComCodeMap(
  groupCode: string,
): Record<string, ComCodeItem> {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const map: Record<string, ComCodeItem> = {};
    for (const c of codes) {
      map[c.detailCode] = c;
    }
    return map;
  }, [data, groupCode]);
}
