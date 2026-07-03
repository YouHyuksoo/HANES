/**
 * @file src/hooks/consumables/useIssuingData.ts
 * @description 출고관리 데이터 훅 - API 연동 및 상태 관리
 *
 * 초보자 가이드:
 * 1. GET /consumables/logs?logTypeGroup=ISSUING 로 공정출고/취소 이력 조회
 * 2. 검색어/유형/기간 필터링은 FE에서 처리
 * 3. 통계 카드 데이터는 오늘 날짜 기준으로 계산
 */
import { useState, useMemo, useCallback } from 'react';
import { api } from '@/services/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getTodayLocal } from '@/utils/date';

export interface IssuingLog {
  id: string;
  consumableId: string;
  consumableCode: string;
  consumableName: string;
  conUid: string | null;
  logType: 'OUT' | 'OUT_RETURN';
  qty: number;
  department: string | null;
  lineCode: string | null;
  processCode: string | null;
  equipCode: string | null;
  issueReason: string | null;
  returnReason: string | null;
  remark: string | null;
  createdAt: string;
}

export function useIssuingData() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const today = getTodayLocal();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const queryClient = useQueryClient();

  const queryKey = ['consumables', 'issuing-logs', startDate, endDate];

  const { data = [], isLoading } = useQuery<IssuingLog[]>({
    queryKey,
    queryFn: async () => {
      const res = await api.get('/consumables/logs', {
        params: { logTypeGroup: 'ISSUING', fromDate: startDate, toDate: endDate, limit: 5000 },
      });
      return res.data?.data ?? [];
    },
  });

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch = !searchTerm ||
        item.consumableCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.consumableName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.conUid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.processCode?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = !typeFilter || item.logType === typeFilter;
      return matchSearch && matchType;
    });
  }, [data, searchTerm, typeFilter]);

  const todayStats = useMemo(() => {
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
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    todayStats,
    refresh,
  };
}
