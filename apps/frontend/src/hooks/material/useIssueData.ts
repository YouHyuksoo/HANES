/**
 * @file src/pages/material/issue/hooks/useIssueData.ts
 * @description 출고관리(처리) 데이터 관리 훅 - 자재창고 담당자 관점
 *
 * 초보자 가이드:
 * 1. **요청 목록**: 생산현장에서 올라온 출고요청 목록
 * 2. **승인/출고**: REQUESTED → APPROVED → IN_PROGRESS → COMPLETED
 * 3. **반려**: REQUESTED → REJECTED
 */
import { useState, useMemo } from 'react';
import type { IssueStatus } from '@/components/material';

/** 출고 처리 대상 레코드 */
export interface IssueRecord {
  id: string;
  requestNo: string;
  issueNo: string | null;
  requestDate: string;
  workOrderNo: string;
  itemCode: string;
  itemName: string;
  unit: string;
  requestQty: number;
  issuedQty: number;
  status: IssueStatus;
  requester: string;
  operator: string | null;
  completedAt: string | null;
}

const mockIssueRecords: IssueRecord[] = [
  { id: '1', requestNo: 'REQ-20250126-001', issueNo: null, requestDate: '2025-01-26', workOrderNo: 'WO-2025-0126-001', itemCode: 'WIRE-001', itemName: 'AWG18 적색', unit: 'M', requestQty: 1000, issuedQty: 0, status: 'REQUESTED', requester: '김생산', operator: null, completedAt: null },
  { id: '2', requestNo: 'REQ-20250126-001', issueNo: null, requestDate: '2025-01-26', workOrderNo: 'WO-2025-0126-001', itemCode: 'TERM-001', itemName: '단자 110형', unit: 'EA', requestQty: 500, issuedQty: 0, status: 'REQUESTED', requester: '김생산', operator: null, completedAt: null },
  { id: '3', requestNo: 'REQ-20250126-002', issueNo: 'ISS-20250126-001', requestDate: '2025-01-26', workOrderNo: 'WO-2025-0126-002', itemCode: 'CONN-001', itemName: '커넥터 6핀', unit: 'EA', requestQty: 200, issuedQty: 0, status: 'APPROVED', requester: '김생산', operator: null, completedAt: null },
  { id: '4', requestNo: 'REQ-20250125-001', issueNo: 'ISS-20250125-001', requestDate: '2025-01-25', workOrderNo: 'WO-2025-0125-001', itemCode: 'WIRE-002', itemName: 'AWG20 흑색', unit: 'M', requestQty: 800, issuedQty: 500, status: 'IN_PROGRESS', requester: '이생산', operator: '박출고', completedAt: null },
  { id: '5', requestNo: 'REQ-20250125-001', issueNo: 'ISS-20250125-002', requestDate: '2025-01-25', workOrderNo: 'WO-2025-0125-001', itemCode: 'TUBE-001', itemName: '수축튜브 5mm', unit: 'M', requestQty: 5000, issuedQty: 5000, status: 'COMPLETED', requester: '이생산', operator: '박출고', completedAt: '2025-01-25 16:30' },
  { id: '6', requestNo: 'REQ-20250125-002', issueNo: null, requestDate: '2025-01-25', workOrderNo: 'WO-2025-0125-002', itemCode: 'TERM-002', itemName: '단자 250형', unit: 'EA', requestQty: 3000, issuedQty: 0, status: 'REJECTED', requester: '박생산', operator: null, completedAt: null },
];

export function useIssueData() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  const filteredRecords = useMemo(() => {
    return mockIssueRecords.filter((r) => {
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchSearch = !searchText
        || r.requestNo.toLowerCase().includes(searchText.toLowerCase())
        || r.itemName.toLowerCase().includes(searchText.toLowerCase())
        || r.workOrderNo.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [statusFilter, searchText]);

  const stats = useMemo(() => ({
    requested: mockIssueRecords.filter((r) => r.status === 'REQUESTED').length,
    approved: mockIssueRecords.filter((r) => r.status === 'APPROVED').length,
    inProgress: mockIssueRecords.filter((r) => r.status === 'IN_PROGRESS').length,
    completed: mockIssueRecords.filter((r) => r.status === 'COMPLETED').length,
  }), []);

  return {
    filteredRecords,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
  };
}
