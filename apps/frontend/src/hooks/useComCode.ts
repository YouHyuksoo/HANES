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
import { useTranslation } from "react-i18next";
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
const COM_CODE_URL = "/master/com-codes/all-active";

const DEFAULT_COLOR =
  "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";

export function useComCodes(enabled: boolean = true) {
  return useApiQuery<ComCodeMap>(COM_CODE_QUERY_KEY, COM_CODE_URL, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
    enabled,
  });
}

/**
 * 현재 locale에 따라 코드의 적절한 이름을 반환하는 헬퍼
 * i18n 번역 파일에 comCode.{groupCode}.{detailCode} 키가 있으면 해당 번역 사용,
 * 없으면 DB의 codeName(한국어) 폴백
 */
function getLocalizedCodeName(
  t: (key: string, options?: Record<string, unknown>) => string,
  groupCode: string,
  detailCode: string,
  fallback: string,
): string {
  const key = `comCode.${groupCode}.${detailCode}`;
  const translated = t(key, { defaultValue: "" });
  return translated || fallback;
}

export function useComCodeOptions(
  groupCode: string,
  includeAll: boolean = false,
) {
  const { data } = useComCodes();
  const { t } = useTranslation();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const options = codes.map((c: ComCodeItem) => ({
      value: c.detailCode,
      label: getLocalizedCodeName(t, groupCode, c.detailCode, c.codeName),
    }));
    if (includeAll) {
      return [{ value: "", label: t("common.all", { defaultValue: "전체" }) }, ...options];
    }
    return options;
  }, [data, groupCode, includeAll, t]);
}

export function useComCodeLabel(
  groupCode: string,
  detailCode: string,
): string {
  const { data } = useComCodes();
  const { t } = useTranslation();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const found = codes.find(
      (c: ComCodeItem) => c.detailCode === detailCode,
    );
    if (!found) return detailCode;
    return getLocalizedCodeName(t, groupCode, detailCode, found.codeName);
  }, [data, groupCode, detailCode, t]);
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
