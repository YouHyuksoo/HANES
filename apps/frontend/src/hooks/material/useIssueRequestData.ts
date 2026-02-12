/**
 * @file src/pages/material/issue-request/hooks/useIssueRequestData.ts
 * @description 출고요청 데이터 관리 훅 - mock 데이터 기반
 *
 * 초보자 가이드:
 * 1. **mockRequests**: 내 출고요청 목록
 * 2. **mockStockItems**: 검색 가능한 품목 + 현재고 정보
 * 3. **stats**: 요청 상태별 통계
 */
import { useState, useMemo } from 'react';
import type { IssueRequestStatus } from '@/components/material';

/** 요청 품목 아이템 */
export interface RequestItem {
  partCode: string;
  partName: string;
  unit: string;
  currentStock: number;
  requestQty: number;
}

/** 출고요청 레코드 */
export interface IssueRequest {
  id: string;
  requestNo: string;
  requestDate: string;
  workOrderNo: string;
  items: RequestItem[];
  totalQty: number;
  status: IssueRequestStatus;
  requester: string;
  rejectReason?: string;
}

/** 검색 가능한 품목 (재고 정보 포함) */
export interface StockItem {
  partCode: string;
  partName: string;
  category: string;
  currentStock: number;
  unit: string;
}

const mockStockItems: StockItem[] = [
  { partCode: 'WIRE-001', partName: 'AWG18 적색', category: '전선', currentStock: 45000, unit: 'M' },
  { partCode: 'WIRE-002', partName: 'AWG20 흑색', category: '전선', currentStock: 8000, unit: 'M' },
  { partCode: 'TERM-001', partName: '단자 110형', category: '단자', currentStock: 50000, unit: 'EA' },
  { partCode: 'TERM-002', partName: '단자 250형', category: '단자', currentStock: 15000, unit: 'EA' },
  { partCode: 'CONN-001', partName: '커넥터 6핀', category: '커넥터', currentStock: 12000, unit: 'EA' },
  { partCode: 'CONN-002', partName: '커넥터 12핀', category: '커넥터', currentStock: 3000, unit: 'EA' },
  { partCode: 'TUBE-001', partName: '수축튜브 5mm', category: '부자재', currentStock: 100000, unit: 'M' },
  { partCode: 'TAPE-001', partName: '절연테이프', category: '부자재', currentStock: 500, unit: 'ROLL' },
];

const mockRequests: IssueRequest[] = [
  {
    id: '1', requestNo: 'REQ-20250126-001', requestDate: '2025-01-26', workOrderNo: 'WO-2025-0126-001',
    items: [
      { partCode: 'WIRE-001', partName: 'AWG18 적색', unit: 'M', currentStock: 45000, requestQty: 1000 },
      { partCode: 'TERM-001', partName: '단자 110형', unit: 'EA', currentStock: 50000, requestQty: 500 },
    ],
    totalQty: 1500, status: 'REQUESTED', requester: '김생산',
  },
  {
    id: '2', requestNo: 'REQ-20250126-002', requestDate: '2025-01-26', workOrderNo: 'WO-2025-0126-002',
    items: [
      { partCode: 'CONN-001', partName: '커넥터 6핀', unit: 'EA', currentStock: 12000, requestQty: 200 },
    ],
    totalQty: 200, status: 'APPROVED', requester: '김생산',
  },
  {
    id: '3', requestNo: 'REQ-20250125-001', requestDate: '2025-01-25', workOrderNo: 'WO-2025-0125-001',
    items: [
      { partCode: 'WIRE-002', partName: 'AWG20 흑색', unit: 'M', currentStock: 8000, requestQty: 800 },
      { partCode: 'TUBE-001', partName: '수축튜브 5mm', unit: 'M', currentStock: 100000, requestQty: 5000 },
    ],
    totalQty: 5800, status: 'COMPLETED', requester: '이생산',
  },
  {
    id: '4', requestNo: 'REQ-20250125-002', requestDate: '2025-01-25', workOrderNo: 'WO-2025-0125-002',
    items: [
      { partCode: 'TERM-002', partName: '단자 250형', unit: 'EA', currentStock: 15000, requestQty: 3000 },
    ],
    totalQty: 3000, status: 'REJECTED', requester: '박생산', rejectReason: '재고 부족',
  },
];

const workOrderOptions = [
  { value: '', label: '전체 작업지시' },
  { value: 'WO-2025-0126-001', label: 'WO-2025-0126-001' },
  { value: 'WO-2025-0126-002', label: 'WO-2025-0126-002' },
  { value: 'WO-2025-0125-001', label: 'WO-2025-0125-001' },
  { value: 'WO-2025-0125-002', label: 'WO-2025-0125-002' },
];

export function useIssueRequestData() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const filteredRequests = useMemo(() => {
    return mockRequests.filter((r) => {
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchSearch = !searchText
        || r.requestNo.toLowerCase().includes(searchText.toLowerCase())
        || r.workOrderNo.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [statusFilter, searchText]);

  const stats = useMemo(() => ({
    requested: mockRequests.filter((r) => r.status === 'REQUESTED').length,
    approved: mockRequests.filter((r) => r.status === 'APPROVED').length,
    completed: mockRequests.filter((r) => r.status === 'COMPLETED').length,
    totalPending: mockRequests.filter((r) => r.status === 'REQUESTED').length,
  }), []);

  const searchStockItems = (query: string): StockItem[] => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return mockStockItems.filter(
      (s) => s.partCode.toLowerCase().includes(q) || s.partName.toLowerCase().includes(q)
    );
  };

  return {
    filteredRequests,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    searchStockItems,
    workOrderOptions,
    stockItems: mockStockItems,
  };
}
