/**
 * @file src/hooks/consumables/useStockData.ts
 * @description 소모품 재고현황 데이터 훅 — 개별 인스턴스(conUid) 기반 API 연동
 *
 * 초보자 가이드:
 * 1. GET /consumables/stocks 로 conUid별 개별 인스턴스 조회
 * 2. 카테고리/인스턴스상태/검색어 필터링
 * 3. 통계(전체 인스턴스, ACTIVE, MOUNTED, PENDING) 산출
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '@/services/api';

export interface ConsumableStock {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  category: string | null;
  status: string;
  currentCount: number;
  expectedLife: number | null;
  location: string | null;
  mountedEquipCode: string | null;
  recvDate: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  unitPrice: number | null;
  remark: string | null;
  createdAt: string;
}

export function useStockData() {
  const [rawData, setRawData] = useState<ConsumableStock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockStatusFilter, setStockStatusFilter] = useState('');

  /** API에서 개별 인스턴스 목록 조회 */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/consumables/stocks');
      const items = res.data?.data ?? res.data ?? [];
      setRawData(Array.isArray(items) ? items : []);
    } catch {
      setRawData([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredData = useMemo(() => {
    return rawData.filter((item) => {
      const matchSearch = !searchTerm ||
        item.conUid.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.consumableCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.consumableName ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = !categoryFilter || item.category === categoryFilter;
      const matchStatus = !stockStatusFilter || item.status === stockStatusFilter;
      return matchSearch && matchCategory && matchStatus;
    });
  }, [rawData, searchTerm, categoryFilter, stockStatusFilter]);

  const summary = useMemo(() => {
    return {
      totalItems: rawData.length,
      activeCount: rawData.filter((d) => d.status === 'ACTIVE').length,
      mountedCount: rawData.filter((d) => d.status === 'MOUNTED').length,
      pendingCount: rawData.filter((d) => d.status === 'PENDING').length,
    };
  }, [rawData]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data: filteredData,
    isLoading,
    searchTerm,
    setSearchTerm,
    categoryFilter,
    setCategoryFilter,
    stockStatusFilter,
    setStockStatusFilter,
    summary,
    refresh,
  };
}
