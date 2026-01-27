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

import { useMemo } from 'react';
import { useApiQuery } from './useApi';

/** 공통코드 단일 항목 */
export interface ComCodeItem {
  detailCode: string;
  codeName: string;
  codeDesc: string | null;
  sortOrder: number;
  attr1: string | null;
  attr2: string | null;
  attr3: string | null;
}

/** groupCode별 코드 목록 맵 */
export type ComCodeMap = Record<string, ComCodeItem[]>;

const COM_CODE_QUERY_KEY = ['com-codes', 'all-active'];
const COM_CODE_URL = '/v1/master/com-codes/all-active';

/** 기본 색상 (DB에 없을 때 fallback) */
const DEFAULT_COLOR = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';

/**
 * 전체 활성 공통코드 조회
 * staleTime 5분으로 불필요한 재요청 방지
 */
export function useComCodes() {
  return useApiQuery<ComCodeMap>(COM_CODE_QUERY_KEY, COM_CODE_URL, {
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

/**
 * Select/드롭다운용 options 배열 반환
 * @param groupCode 공통코드 그룹 (예: 'JOB_ORDER_STATUS')
 * @param includeAll 전체 옵션 포함 여부 (기본: false)
 * @returns [{ value: 'WAITING', label: '대기' }, ...]
 */
export function useComCodeOptions(
  groupCode: string,
  includeAll: boolean = false
) {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const options = codes.map((c: ComCodeItem) => ({
      value: c.detailCode,
      label: c.codeName,
    }));
    if (includeAll) {
      return [{ value: '', label: '전체' }, ...options];
    }
    return options;
  }, [data, groupCode, includeAll]);
}

/**
 * 코드의 한국어 라벨 반환
 */
export function useComCodeLabel(groupCode: string, detailCode: string): string {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const found = codes.find((c: ComCodeItem) => c.detailCode === detailCode);
    return found?.codeName ?? detailCode;
  }, [data, groupCode, detailCode]);
}

/**
 * 코드의 Tailwind 색상 클래스 반환
 */
export function useComCodeColor(groupCode: string, detailCode: string): string {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    const found = codes.find((c: ComCodeItem) => c.detailCode === detailCode);
    return found?.attr1 ?? DEFAULT_COLOR;
  }, [data, groupCode, detailCode]);
}

/**
 * 코드의 전체 항목 반환 (라벨, 색상, 아이콘 등)
 */
export function useComCodeItem(groupCode: string, detailCode: string): ComCodeItem | null {
  const { data } = useComCodes();
  return useMemo(() => {
    const codes = data?.data?.[groupCode] ?? [];
    return codes.find((c: ComCodeItem) => c.detailCode === detailCode) ?? null;
  }, [data, groupCode, detailCode]);
}

/**
 * 그룹의 전체 코드 목록 반환 (raw)
 */
export function useComCodeList(groupCode: string): ComCodeItem[] {
  const { data } = useComCodes();
  return useMemo(() => {
    return data?.data?.[groupCode] ?? [];
  }, [data, groupCode]);
}

/**
 * 그룹의 코드맵 반환 (detailCode → ComCodeItem)
 */
export function useComCodeMap(groupCode: string): Record<string, ComCodeItem> {
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
