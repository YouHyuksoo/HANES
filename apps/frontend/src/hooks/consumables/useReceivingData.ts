/**
 * @file src/hooks/consumables/useReceivingData.ts
 * @description 입고관리 데이터 훅 - API 연동 및 상태 관리
 *
 * 초보자 가이드:
 * 1. GET /consumables/logs?logTypeGroup=RECEIVING 로 입고/반품 이력 조회
 * 2. 검색어/유형 필터링은 FE에서 처리
 * 3. 통계 카드 데이터는 오늘 날짜 기준으로 계산
 */
import { useState, useMemo, useCallback } from 'react';
import { api } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface ReceivingLog {
  id: string;
  consumableId: string;
  consumableCode: string;
  consumableName: string;
  logType: 'IN' | 'IN_RETURN';
  qty: number;
  vendorCode: string | null;
  vendorName: string | null;
  unitPrice: number | null;
  incomingType: string | null;
  returnReason: string | null;
  remark: string | null;
  createdAt: string;
}

export interface ReceivingFormData {
  consumableId: string;
  qty: number;
  vendorCode: string;
  vendorName: string;
  unitPrice: number | null;
  incomingType: string;
  remark: string;
}

export interface ReceivingReturnFormData {
  consumableId: string;
  qty: number;
  vendorCode: string;
  vendorName: string;
  returnReason: string;
  remark: string;
}

export function useReceivingData() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery<ReceivingLog[]>({
    queryKey: ['consumables', 'receiving-logs'],
    queryFn: async () => {
      const res = await api.get('/consumables/logs', {
        params: { logTypeGroup: 'RECEIVING', limit: 5000 },
      });
      return res.data?.data ?? [];
    },
  });

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch = !searchTerm ||
        item.consumableCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.consumableName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = !typeFilter || item.logType === typeFilter;
      return matchSearch && matchType;
    });
  }, [data, searchTerm, typeFilter]);

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayData = data.filter((d) => d.createdAt?.startsWith(today));
    const inData = todayData.filter((d) => d.logType === 'IN');
    return {
      inCount: inData.length,
      inAmount: inData.reduce((sum, d) => sum + (d.unitPrice ?? 0) * d.qty, 0),
      returnCount: todayData.filter((d) => d.logType === 'IN_RETURN').length,
    };
  }, [data]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['consumables', 'receiving-logs'] });
  }, [queryClient]);

  return {
    data: filteredData,
    isLoading,
    searchTerm,
    setSearchTerm,
    typeFilter,
    setTypeFilter,
    todayStats,
    refresh,
  };
}
