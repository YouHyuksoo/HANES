/**
 * @file src/hooks/consumables/useIssuingData.ts
 * @description 출고관리 데이터 훅 - API 연동 및 상태 관리
 *
 * 초보자 가이드:
 * 1. GET /consumables/logs?logTypeGroup=ISSUING 로 출고/반품 이력 조회
 * 2. 검색어/유형 필터링은 FE에서 처리
 * 3. 통계 카드 데이터는 오늘 날짜 기준으로 계산
 */
import { useState, useMemo, useCallback } from 'react';
import { api } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface IssuingLog {
  id: string;
  consumableId: string;
  consumableCode: string;
  consumableName: string;
  logType: 'OUT' | 'OUT_RETURN';
  qty: number;
  department: string | null;
  lineId: string | null;
  equipCode: string | null;
  issueReason: string | null;
  returnReason: string | null;
  remark: string | null;
  createdAt: string;
}

export function useIssuingData() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery<IssuingLog[]>({
    queryKey: ['consumables', 'issuing-logs'],
    queryFn: async () => {
      const res = await api.get('/consumables/logs', {
        params: { logTypeGroup: 'ISSUING', limit: 5000 },
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
    return {
      outCount: todayData.filter((d) => d.logType === 'OUT').length,
      returnCount: todayData.filter((d) => d.logType === 'OUT_RETURN').length,
      unreturned: data.filter((d) => d.logType === 'OUT').length -
        data.filter((d) => d.logType === 'OUT_RETURN').length,
    };
  }, [data]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['consumables', 'issuing-logs'] });
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
