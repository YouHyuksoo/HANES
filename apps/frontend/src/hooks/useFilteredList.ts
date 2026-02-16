/**
 * @file src/hooks/useFilteredList.ts
 * @description 목록 데이터 필터링 공통 훅
 *
 * 사용법:
 * ```tsx
 * const { filteredData, filters, stats, refresh } = useFilteredList(data, {
 *   searchFields: ['partCode', 'partName'],
 *   statusField: 'status',
 *   statusValues: ['PENDING', 'COMPLETED'],
 * });
 * ```
 */

import { useState, useMemo, useCallback } from "react";

export interface UseFilteredListOptions<T> {
  /** 검색 대상 필드 목록 */
  searchFields?: (keyof T)[];
  /** 상태 필드명 */
  statusField?: keyof T;
  /** 상태 필터 값 목록 (미지정시 모든 값 허용) */
  statusValues?: string[];
  /** 날짜 필드명 */
  dateField?: keyof T;
}

export interface UseFilteredListStats {
  total: number;
  [key: string]: number;
}

export interface UseFilteredListReturn<T> {
  /** 필터링된 데이터 */
  filteredData: T[];
  /** 필터 상태 및 setter */
  filters: {
    statusFilter: string;
    setStatusFilter: (value: string) => void;
    searchTerm: string;
    setSearchTerm: (value: string) => void;
    fromDate?: string;
    setFromDate?: (value: string) => void;
    toDate?: string;
    setToDate?: (value: string) => void;
  };
  /** 통계 정보 */
  stats: UseFilteredListStats;
  /** 새로고침 함수 */
  refresh: () => void;
  /** 필터 초기화 */
  resetFilters: () => void;
}

/**
 * 목록 데이터 필터링 훅
 */
export function useFilteredList<T extends Record<string, any>>(
  data: T[],
  options: UseFilteredListOptions<T> = {}
): UseFilteredListReturn<T> {
  const { searchFields, statusField, statusValues, dateField } = options;

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // 필터링된 데이터
  const filteredData = useMemo(() => {
    let result = [...data];

    // 상태 필터
    if (statusField && statusFilter) {
      result = result.filter((item) => item[statusField] === statusFilter);
    }

    // 검색어 필터
    if (searchTerm && searchFields?.length) {
      const search = searchTerm.toLowerCase();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const value = item[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(search);
        })
      );
    }

    // 날짜 필터
    if (dateField && (fromDate || toDate)) {
      result = result.filter((item) => {
        const itemDate = item[dateField];
        if (!itemDate) return false;

        const date = new Date(itemDate);
        if (isNaN(date.getTime())) return false;

        const dateStr = date.toISOString().slice(0, 10);

        if (fromDate && dateStr < fromDate) return false;
        if (toDate && dateStr > toDate) return false;

        return true;
      });
    }

    return result;
  }, [data, statusFilter, searchTerm, fromDate, toDate, refreshKey, searchFields, statusField, dateField]);

  // 통계 계산
  const stats = useMemo(() => {
    const baseStats: UseFilteredListStats = {
      total: filteredData.length,
    };

    // 상태별 카운트
    if (statusField && statusValues) {
      statusValues.forEach((status) => {
        baseStats[status] = filteredData.filter(
          (item) => item[statusField] === status
        ).length;
      });
    }

    return baseStats;
  }, [filteredData, statusField, statusValues]);

  // 새로고침
  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // 필터 초기화
  const resetFilters = useCallback(() => {
    setStatusFilter("");
    setSearchTerm("");
    setFromDate("");
    setToDate("");
  }, []);

  return {
    filteredData,
    filters: {
      statusFilter,
      setStatusFilter,
      searchTerm,
      setSearchTerm,
      fromDate,
      setFromDate,
      toDate,
      setToDate,
    },
    stats,
    refresh,
    resetFilters,
  };
}

/**
 * 간단한 검색 필터 훅
 */
export function useSearchFilter<T extends Record<string, any>>(
  data: T[],
  searchFields: (keyof T)[]
) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = useMemo(() => {
    if (!searchTerm || !searchFields.length) return data;

    const search = searchTerm.toLowerCase();
    return data.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(search);
      })
    );
  }, [data, searchTerm, searchFields]);

  return {
    searchTerm,
    setSearchTerm,
    filteredData,
  };
}

/**
 * 상태 필터 훅
 */
export function useStatusFilter<T extends Record<string, any>>(
  data: T[],
  statusField: keyof T
) {
  const [statusFilter, setStatusFilter] = useState("");

  const filteredData = useMemo(() => {
    if (!statusFilter) return data;
    return data.filter((item) => item[statusField] === statusFilter);
  }, [data, statusFilter, statusField]);

  return {
    statusFilter,
    setStatusFilter,
    filteredData,
  };
}
