/**
 * @file src/pages/material/issue/hooks/useIssueData.ts
 * @description 출고관리(처리) 데이터 관리 훅 - 자재창고 담당자 관점
 *
 * 초보자 가이드:
 * 1. **요청 목록**: 생산현장에서 올라온 출고요청 목록
 * 2. **승인/출고**: REQUESTED → APPROVED → IN_PROGRESS → COMPLETED
 * 3. **반려**: REQUESTED → REJECTED
 */
import { useEffect, useMemo, useState } from 'react';
import type { IssueStatus } from '@/components/material';
import { api } from '@/services/api';

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

interface MatIssueApiRow {
  issueNo?: string;
  seq?: number;
  issueDate?: string;
  orderNo?: string | null;
  jobOrderNo?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  unit?: string | null;
  qty?: number;
  issueQty?: number;
  status?: string;
  workerId?: string | null;
}

interface PagedResponse<T> {
  data?: T[];
}

export function useIssueData() {
  const [records, setRecords] = useState<IssueRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchIssues() {
      try {
        const response = await api.get<PagedResponse<MatIssueApiRow>>('/material/issues', {
          params: { limit: 200 },
        });
        const rows = (response.data?.data ?? []).map((row, index) => ({
          id: `${row.issueNo ?? 'issue'}-${row.seq ?? index}`,
          requestNo: row.jobOrderNo ?? row.orderNo ?? '',
          issueNo: row.issueNo ?? null,
          requestDate: row.issueDate ? String(row.issueDate).slice(0, 10) : '',
          workOrderNo: row.jobOrderNo ?? row.orderNo ?? '',
          itemCode: row.itemCode ?? '',
          itemName: row.itemName ?? row.itemCode ?? '',
          unit: row.unit ?? '',
          requestQty: row.qty ?? row.issueQty ?? 0,
          issuedQty: row.qty ?? row.issueQty ?? 0,
          status: row.status === 'CANCELED' ? 'REJECTED' : 'COMPLETED' as IssueStatus,
          requester: row.workerId ?? '',
          operator: row.workerId ?? null,
          completedAt: row.issueDate ? String(row.issueDate).slice(0, 16).replace('T', ' ') : null,
        }));

        if (!cancelled) setRecords(rows);
      } catch {
        if (!cancelled) setRecords([]);
      }
    }

    fetchIssues();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchSearch = !searchText
        || r.requestNo.toLowerCase().includes(searchText.toLowerCase())
        || r.itemName.toLowerCase().includes(searchText.toLowerCase())
        || r.workOrderNo.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [records, statusFilter, searchText]);

  const stats = useMemo(() => ({
    requested: records.filter((r) => r.status === 'REQUESTED').length,
    approved: records.filter((r) => r.status === 'APPROVED').length,
    inProgress: records.filter((r) => r.status === 'IN_PROGRESS').length,
    completed: records.filter((r) => r.status === 'COMPLETED').length,
  }), [records]);

  return {
    filteredRecords,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
  };
}
