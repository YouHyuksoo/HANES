/**
 * @file src/pages/consumables/receiving/hooks/useReceivingData.ts
 * @description 입고관리 데이터 훅 - API 연동 및 상태 관리
 */
import { useState, useMemo, useCallback } from 'react';


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

/** mock 데이터 (API 연결 전) */
const mockData: ReceivingLog[] = [
  {
    id: '1', consumableId: 'c1', consumableCode: 'MOLD-001', consumableName: '압착금형 A타입',
    logType: 'IN', qty: 5, vendorCode: 'V001', vendorName: '한국금형', unitPrice: 150000,
    incomingType: 'NEW', returnReason: null, remark: '신규 입고', createdAt: '2025-01-27 09:00',
  },
  {
    id: '2', consumableId: 'c2', consumableCode: 'TOOL-001', consumableName: '절단날 표준형',
    logType: 'IN', qty: 10, vendorCode: 'V002', vendorName: '대성공구', unitPrice: 25000,
    incomingType: 'REPLACEMENT', returnReason: null, remark: '교체 입고', createdAt: '2025-01-27 10:30',
  },
  {
    id: '3', consumableId: 'c1', consumableCode: 'MOLD-001', consumableName: '압착금형 A타입',
    logType: 'IN_RETURN', qty: 1, vendorCode: 'V001', vendorName: '한국금형', unitPrice: null,
    incomingType: null, returnReason: '불량품 반품', remark: '크랙 발견', createdAt: '2025-01-26 14:00',
  },
];

export function useReceivingData() {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // TODO: API 연결 시 교체
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
    const inData = todayData.filter((d) => d.logType === 'IN');
    return {
      inCount: inData.length,
      inAmount: inData.reduce((sum, d) => sum + (d.unitPrice ?? 0) * d.qty, 0),
      returnCount: todayData.filter((d) => d.logType === 'IN_RETURN').length,
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
