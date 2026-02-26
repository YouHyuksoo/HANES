/**
 * @file src/pages/consumables/issuing/hooks/useIssuingData.ts
 * @description 출고관리 데이터 훅 - API 연동 및 상태 관리
 */
import { useState, useMemo, useCallback } from 'react';

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

/** mock 데이터 (API 연결 전) */
const mockData: IssuingLog[] = [
  {
    id: '1', consumableId: 'c1', consumableCode: 'MOLD-001', consumableName: '압착금형 A타입',
    logType: 'OUT', qty: 1, department: '생산1팀', lineId: 'LINE-A', equipCode: 'EQ-001',
    issueReason: 'PRODUCTION', returnReason: null, remark: '압착라인 A 투입', createdAt: '2025-01-27 09:00',
  },
  {
    id: '2', consumableId: 'c3', consumableCode: 'JIG-001', consumableName: '조립지그 001',
    logType: 'OUT', qty: 2, department: '생산2팀', lineId: 'LINE-B', equipCode: null,
    issueReason: 'REPAIR', returnReason: null, remark: '수리용 출고', createdAt: '2025-01-27 11:00',
  },
  {
    id: '3', consumableId: 'c1', consumableCode: 'MOLD-001', consumableName: '압착금형 A타입',
    logType: 'OUT_RETURN', qty: 1, department: null, lineId: null, equipCode: null,
    issueReason: null, returnReason: '작업 종료 반납', remark: '정상 반납', createdAt: '2025-01-27 18:00',
  },
];

export function useIssuingData() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const data = mockData;
  const isLoading = false;

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchSearch = !searchTerm ||
        item.consumableCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.consumableName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = !typeFilter || item.logType === typeFilter;
      return matchSearch && matchType;
    });
  }, [data, searchTerm, typeFilter]);

  const todayStats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayData = data.filter((d) => d.createdAt.startsWith(today));
    return {
      outCount: todayData.filter((d) => d.logType === 'OUT').length,
      returnCount: todayData.filter((d) => d.logType === 'OUT_RETURN').length,
      unreturned: data.filter((d) => d.logType === 'OUT').length -
        data.filter((d) => d.logType === 'OUT_RETURN').length,
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
    typeFilter,
    setTypeFilter,
    todayStats,
    refresh,
  };
}
