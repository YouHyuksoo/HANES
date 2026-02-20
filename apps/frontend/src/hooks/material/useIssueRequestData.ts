/**
 * @file src/hooks/material/useIssueRequestData.ts
 * @description 출고요청 데이터 관리 훅 - API 기반
 *
 * 초보자 가이드:
 * 1. **useApiQuery**: GET /material/issue-requests 로 출고요청 목록 조회
 * 2. **searchStockItems**: GET /master/parts?search=검색어 로 품목 + 현재고 검색
 * 3. **stats**: API 응답 데이터에서 상태별 카운트 계산
 * 4. **workOrderOptions**: 작업지시 목록 API로 드롭다운 옵션 제공
 */
import { useState, useMemo, useCallback } from 'react';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';
import type { IssueRequestStatus } from '@/components/material';

/** 요청 품목 아이템 */
export interface RequestItem {
  partId?: string;
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
  id?: string;
  partCode: string;
  partName: string;
  category: string;
  currentStock: number;
  unit: string;
}

/** 목록 API 응답 */
interface IssueRequestListResponse {
  data: IssueRequest[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** 작업지시 레코드 (드롭다운용) */
interface JobOrderRecord {
  id: string;
  orderNo: string;
}

/** 작업지시 목록 응답 */
interface JobOrderListResponse {
  data: JobOrderRecord[];
  total?: number;
}

/** 품목 검색 응답 */
interface PartSearchResponse {
  data: Array<{
    id: string;
    partCode: string;
    partName: string;
    partType?: string;
    unit?: string;
    currentStock?: number;
  }>;
}

export function useIssueRequestData() {
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

  // 출고요청 목록 조회
  const { data: requestData, isLoading, refetch } = useApiQuery<IssueRequestListResponse>(
    ['issue-request-data', String(page), statusFilter, searchText],
    `/material/issue-requests?${queryParams}`,
    { staleTime: 30_000 },
  );

  // 작업지시 목록 조회 (드롭다운 옵션용)
  const { data: jobOrderData } = useApiQuery<JobOrderListResponse>(
    ['job-orders', 'options'],
    '/production/job-orders?limit=100',
    { staleTime: 5 * 60_000 },
  );

  // 레코드 목록 추출
  const allRequests = useMemo(() => {
    const raw = requestData?.data;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : (raw as IssueRequestListResponse)?.data ?? [];
  }, [requestData]);

  // 프론트 필터링 (API에서 이미 필터링되지만 혹시 안될 때 대비)
  const filteredRequests = useMemo(() => allRequests, [allRequests]);

  // 통계 계산
  const stats = useMemo(() => ({
    requested: allRequests.filter((r) => r.status === 'REQUESTED').length,
    approved: allRequests.filter((r) => r.status === 'APPROVED').length,
    completed: allRequests.filter((r) => r.status === 'COMPLETED').length,
    totalPending: allRequests.filter((r) => r.status === 'REQUESTED').length,
  }), [allRequests]);

  // 품목 검색 (비동기 API 호출)
  const searchStockItems = useCallback(async (query: string): Promise<StockItem[]> => {
    if (!query.trim()) return [];
    try {
      const response = await api.get<{ success: boolean; data: PartSearchResponse }>(
        `/master/parts?search=${encodeURIComponent(query)}&limit=20`,
      );
      const raw = response.data?.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      return list.map((p) => ({
        id: p.id,
        partCode: p.partCode,
        partName: p.partName,
        category: p.partType ?? '',
        currentStock: p.currentStock ?? 0,
        unit: p.unit ?? 'EA',
      }));
    } catch {
      console.warn('[useIssueRequestData] 품목 검색 실패:', query);
      return [];
    }
  }, []);

  // 작업지시 드롭다운 옵션
  const workOrderOptions = useMemo(() => {
    const raw = jobOrderData?.data;
    const list = Array.isArray(raw) ? raw : (raw as JobOrderListResponse)?.data ?? [];
    return [
      { value: '', label: '전체 작업지시' },
      ...list.map((j) => ({ value: j.orderNo ?? j.id, label: j.orderNo ?? j.id })),
    ];
  }, [jobOrderData]);

  return {
    filteredRequests,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    searchStockItems,
    workOrderOptions,
    stockItems: [] as StockItem[],
    isLoading,
    refetch,
    invalidate,
    page,
    setPage,
  };
}
