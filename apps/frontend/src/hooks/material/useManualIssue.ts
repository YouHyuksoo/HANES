/**
 * @file src/hooks/material/useManualIssue.ts
 * @description 수동출고 훅 - 가용재고 조회 및 수동 출고 처리
 *
 * 초보자 가이드:
 * 1. **가용재고**: IQC 합격(PASS)된 LOT만 출고 가능
 * 2. **selectedItems**: Map(stockId -> issueQty)으로 선택/수량 관리
 * 3. **toggleSelect**: 체크박스 토글 시 기본값 = 가용수량
 * 4. **updateQty**: 개별 출고수량 수정
 * 5. **handleIssue**: 선택된 품목 일괄 출고 (POST /material/issues)
 */
import { useState, useMemo, useCallback } from 'react';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';

/** 가용 재고 아이템 */
export interface AvailableStock {
  id: string;
  lotId: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  unit: string;
  warehouseCode: string;
  warehouseName: string;
  availableQty: number;
  iqcStatus: string;
  supplierName?: string;
}

/** 가용재고 응답 */
interface AvailableStockResponse {
  data: AvailableStock[];
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
}

/**
 * 수동출고 관리 훅
 * - 가용재고(IQC PASS) 조회
 * - 체크박스 선택/해제 관리
 * - 출고수량 편집
 * - 일괄 출고 처리
 */
export function useManualIssue() {
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [issueType, setIssueType] = useState<string>('PRODUCTION');
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const invalidate = useInvalidateQueries();

  // 쿼리 파라미터
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ page: '1', limit: '100' });
    if (warehouseFilter) params.set('warehouseCode', warehouseFilter);
    if (searchText) params.set('search', searchText);
    return params.toString();
  }, [warehouseFilter, searchText]);

  // 가용재고 조회
  const { data, isLoading, refetch } = useApiQuery<AvailableStockResponse>(
    ['stocks-available', warehouseFilter, searchText],
    `/material/stocks/available?${queryParams}`,
    { staleTime: 30_000 },
  );

  // 가용재고 목록 추출
  const availableStocks = useMemo(() => {
    const raw = data?.data;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : (raw as AvailableStockResponse)?.data ?? [];
  }, [data]);

  // 체크박스 토글 (선택 시 기본값 = 가용수량)
  const toggleSelect = useCallback((stockId: string, availableQty: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(stockId)) {
        next.delete(stockId);
      } else {
        next.set(stockId, availableQty);
      }
      return next;
    });
  }, []);

  // 출고수량 수정
  const updateQty = useCallback((stockId: string, qty: number) => {
    setSelectedItems((prev) => {
      const next = new Map(prev);
      if (next.has(stockId)) {
        next.set(stockId, qty);
      }
      return next;
    });
  }, []);

  // 전체 선택/해제
  const toggleAll = useCallback((stocks: AvailableStock[]) => {
    setSelectedItems((prev) => {
      if (prev.size === stocks.length) {
        return new Map();
      }
      const next = new Map<string, number>();
      stocks.forEach((s) => next.set(s.id, s.availableQty));
      return next;
    });
  }, []);

  // 선택된 총 출고수량
  const totalIssueQty = useMemo(() => {
    let sum = 0;
    selectedItems.forEach((qty) => { sum += qty; });
    return sum;
  }, [selectedItems]);

  // 일괄 출고 처리
  const handleIssue = useCallback(async () => {
    const items = [...selectedItems.entries()].map(([stockId, qty]) => {
      const stock = availableStocks.find((s) => s.id === stockId);
      return { lotId: stock?.lotId ?? stockId, issueQty: qty };
    });
    await api.post('/material/issues', { items, issueType });
    setSelectedItems(new Map());
    invalidate(['stocks-available']);
    invalidate(['issue-history']);
    refetch();
  }, [selectedItems, availableStocks, issueType, invalidate, refetch]);

  return {
    availableStocks,
    isLoading,
    refetch,
    warehouseFilter,
    setWarehouseFilter,
    searchText,
    setSearchText,
    issueType,
    setIssueType,
    selectedItems,
    toggleSelect,
    updateQty,
    toggleAll,
    totalIssueQty,
    handleIssue,
  };
}
