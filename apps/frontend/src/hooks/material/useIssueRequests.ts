/**
 * @file src/hooks/material/useIssueRequests.ts
 * @description 출고요청 관리 훅 - 목록 조회, 승인/반려, 통계 처리
 *
 * 초보자 가이드:
 * 1. **useApiQuery**: GET 요청으로 출고요청 목록을 조회
 * 2. **handleApprove**: 요청 승인 처리 (PATCH)
 * 3. **handleReject**: 사유와 함께 요청 반려 처리 (PATCH)
 * 4. **stats**: 응답 데이터에서 상태별 건수를 계산
 * 5. **필터**: 상태, 검색어, 페이지네이션 지원
 */
import { useState, useMemo, useCallback } from 'react';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';

/** 출고요청 품목 아이템 */
export interface IssueRequestItem {
  id: string;
  partCode: string;
  partName: string;
  unit: string;
  requestQty: number;
  issuedQty: number;
}

/** 출고요청 레코드 */
export interface IssueRequestRecord {
  id: string;
  requestNo: string;
  requestDate: string;
  workOrderNo: string;
  items: IssueRequestItem[];
  itemCount: number;
  totalQty: number;
  status: string;
  requester: string;
  rejectReason?: string;
  createdAt: string;
}

/** 목록 응답 */
interface IssueRequestListResponse {
  data: IssueRequestRecord[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** 통계 */
export interface IssueRequestStats {
  requested: number;
  approved: number;
  completed: number;
  rejected: number;
}

/**
 * 출고요청 관리 훅
 * - 목록 조회 (필터/페이지네이션)
 * - 승인/반려 처리
 * - 상태별 통계 계산
 */
export function useIssueRequests() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const invalidate = useInvalidateQueries();

  // 쿼리 파라미터 구성
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (statusFilter) params.set('status', statusFilter);
    if (searchText) params.set('search', searchText);
    return params.toString();
  }, [page, statusFilter, searchText]);

  // 목록 조회
  const { data, isLoading, refetch } = useApiQuery<IssueRequestListResponse>(
    ['issue-requests', String(page), statusFilter, searchText],
    `/material/issue-requests?${queryParams}`,
    { staleTime: 30_000 },
  );

  // 레코드 목록 추출
  const records = useMemo(() => {
    const raw = data?.data;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : (raw as IssueRequestListResponse)?.data ?? [];
  }, [data]);

  // 통계 계산 (전체 데이터 기준)
  const stats = useMemo<IssueRequestStats>(() => ({
    requested: records.filter((r) => r.status === 'REQUESTED').length,
    approved: records.filter((r) => r.status === 'APPROVED').length,
    completed: records.filter((r) => r.status === 'COMPLETED').length,
    rejected: records.filter((r) => r.status === 'REJECTED').length,
  }), [records]);

  // 승인 처리
  const handleApprove = useCallback(async (id: string) => {
    await api.patch(`/material/issue-requests/${id}/approve`);
    invalidate(['issue-requests']);
    refetch();
  }, [invalidate, refetch]);

  // 반려 처리
  const handleReject = useCallback(async (id: string, reason: string) => {
    await api.patch(`/material/issue-requests/${id}/reject`, { reason });
    invalidate(['issue-requests']);
    refetch();
  }, [invalidate, refetch]);

  return {
    records,
    isLoading,
    refetch,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    page,
    setPage,
    handleApprove,
    handleReject,
  };
}
