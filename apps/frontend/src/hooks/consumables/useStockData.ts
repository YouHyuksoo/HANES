/**
 * @file src/pages/consumables/stock/hooks/useStockData.ts
 * @description 소모품 재고현황 데이터 훅
 */
import { useState, useMemo, useCallback } from 'react';

export interface ConsumableStock {
  id: string;
  consumableCode: string;
  name: string;
  category: string | null;
  stockQty: number;
  safetyStock: number;
  unitPrice: number | null;
  location: string | null;
  vendor: string | null;
  status: string;
}

/** mock 데이터 (API 연결 전) */
const mockData: ConsumableStock[] = [
  {
    id: 'c1', consumableCode: 'MOLD-001', name: '압착금형 A타입', category: 'MOLD',
    stockQty: 12, safetyStock: 5, unitPrice: 150000, location: 'A-01', vendor: '한국금형', status: 'NORMAL',
  },
  {
    id: 'c2', consumableCode: 'TOOL-001', name: '절단날 표준형', category: 'TOOL',
    stockQty: 3, safetyStock: 10, unitPrice: 25000, location: 'B-03', vendor: '대성공구', status: 'NORMAL',
  },
  {
    id: 'c3', consumableCode: 'JIG-001', name: '조립지그 001', category: 'JIG',
    stockQty: 8, safetyStock: 3, unitPrice: 80000, location: 'C-02', vendor: '정밀지그', status: 'NORMAL',
  },
  {
    id: 'c4', consumableCode: 'MOLD-002', name: '압착금형 B타입', category: 'MOLD',
    stockQty: 0, safetyStock: 2, unitPrice: 200000, location: 'A-02', vendor: '한국금형', status: 'WARNING',
  },
];

export function useStockData() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const data = mockData;
  const isLoading = false;

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch = !searchTerm ||
        item.consumableCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = !categoryFilter || item.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [data, searchTerm, categoryFilter]);

  const summary = useMemo(() => {
    return {
      totalItems: data.length,
      belowSafety: data.filter((d) => d.stockQty < d.safetyStock).length,
      outOfStock: data.filter((d) => d.stockQty === 0).length,
      totalValue: data.reduce((sum, d) => sum + (d.unitPrice ?? 0) * d.stockQty, 0),
    };
  }, [data]);

  const refresh = useCallback(() => {
    // TODO: invalidate query
  }, []);

  return {
    data: filteredData,
    isLoading,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    summary,
    refresh,
  };
}
