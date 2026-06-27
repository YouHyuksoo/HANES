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
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useApiQuery, useInvalidateQueries } from '@/hooks/useApi';
import { api } from '@/services/api';
import type { IssueRequestStatus } from '@/components/material';
import type { ProductionJobOrderRow } from '@harness/shared';

/** 요청 품목 아이템 */
export interface RequestItem {
  seq?: number;
  requestId?: string;
  itemCode: string;
  itemName?: string | null;
  unit?: string | null;
  currentStock: number;
  requestQty: number;
  issuedQty?: number;
  bomReqQty?: number;
  prevIssueQty?: number;
  floorStockQty?: number;
  /** 포장단위(최소 출고/불출 단위). 실출고 = ceil(요청/minPackQty)*minPackQty */
  minPackQty?: number;
  remark?: string | null;
}

/** 출고요청 레코드 */
export interface IssueRequest {
  id?: string;
  requestNo: string;
  requestDate?: string;
  orderNo?: string | null;
  workOrderNo?: string | null;
  issueType?: string | null;
  items: RequestItem[];
  itemCount?: number;
  totalQty?: number;
  totalRequestQty?: number;
  totalIssuedQty?: number;
  status: IssueRequestStatus;
  requester: string;
  approver?: string | null;
  approvedAt?: string | null;
  rejectReason?: string | null;
  remark?: string | null;
}

/** 검색 가능한 품목 (재고 정보 포함) */
export interface StockItem {
  id?: string;
  itemCode: string;
  itemName: string;
  category: string;
  currentStock: number;
  unit: string;
  /** 포장단위(최소 출고 단위) */
  minPackQty?: number;
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

/** 작업지시 목록 응답 */
interface JobOrderListResponse {
  data: ProductionJobOrderRow[];
  total?: number;
}

/** 품목 검색 응답 */
interface PartSearchResponse {
  data: Array<{
    id: string;
    itemCode: string;
    itemName: string;
    itemType?: string;
    unit?: string;
    currentStock?: number;
    minPackQty?: number;
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

  // 작업지시 조회 필터 (좌측 패널) - 작업지시번호 / 모델 / 상태
  const [woOrderNo, setWoOrderNo] = useState('');
  const [woModel, setWoModel] = useState('');
  const [woStatus, setWoStatus] = useState('');
  // 텍스트 입력 디바운스 (키 입력마다 요청 방지)
  const [appliedWo, setAppliedWo] = useState({ orderNo: '', model: '' });
  useEffect(() => {
    const id = setTimeout(() => setAppliedWo({ orderNo: woOrderNo, model: woModel }), 300);
    return () => clearTimeout(id);
  }, [woOrderNo, woModel]);

  const jobOrderQuery = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (appliedWo.orderNo.trim()) params.set('orderNo', appliedWo.orderNo.trim());
    if (appliedWo.model.trim()) params.set('search', appliedWo.model.trim());
    if (woStatus) params.set('status', woStatus);
    return params.toString();
  }, [appliedWo, woStatus]);

  // 작업지시 목록 조회 (좌측 패널 + 드롭다운 옵션용)
  const { data: jobOrderData, isLoading: isLoadingJobOrders } = useApiQuery<JobOrderListResponse>(
    ['job-orders', 'options', jobOrderQuery],
    `/production/job-orders?${jobOrderQuery}`,
    { staleTime: 60_000 },
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
      // 출고요청은 원자재만 대상 (소모품 등 제외)
      const response = await api.get<{ success: boolean; data: PartSearchResponse }>(
        `/master/parts?search=${encodeURIComponent(query)}&itemType=RAW_MATERIAL&limit=20`,
      );
      const raw = response.data?.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      return list.map((p) => ({
        id: p.id,
        itemCode: p.itemCode,
        itemName: p.itemName,
        category: p.itemType ?? '',
        currentStock: p.currentStock ?? 0,
        unit: p.unit ?? 'EA',
        minPackQty: Number(p.minPackQty ?? 0),
      }));
    } catch {
      console.warn('[useIssueRequestData] 품목 검색 실패:', query);
      return [];
    }
  }, []);

  const loadBomRequestItems = useCallback(async (orderNo: string): Promise<RequestItem[]> => {
    if (!orderNo) return [];
    const response = await api.get<{ success: boolean; data: RequestItem[] }>(
      `/material/issue-requests/job-orders/${encodeURIComponent(orderNo)}/bom-items`,
    );
    const list = Array.isArray(response.data?.data) ? response.data.data : [];
    return list.map((item) => ({
      itemCode: item.itemCode,
      itemName: item.itemName,
      unit: item.unit ?? 'EA',
      currentStock: Number(item.currentStock ?? 0),
      requestQty: Number(item.requestQty ?? 0),
      bomReqQty: Number(item.bomReqQty ?? 0),
      prevIssueQty: Number(item.prevIssueQty ?? 0),
      floorStockQty: Number(item.floorStockQty ?? 0),
      minPackQty: Number(item.minPackQty ?? 0),
    }));
  }, []);

  // 특정 작업지시의 기존 출고요청 내역 조회 (우측 그룹 상세용)
  const loadRequestsByOrder = useCallback(async (orderNo: string): Promise<IssueRequest[]> => {
    if (!orderNo) return [];
    const response = await api.get<{ success: boolean; data: IssueRequest[] | { data: IssueRequest[] } }>(
      `/material/issue-requests?orderNo=${encodeURIComponent(orderNo)}&limit=50`,
    );
    const raw = response.data?.data;
    return Array.isArray(raw) ? raw : raw?.data ?? [];
  }, []);

  // 작업지시 목록 (서버에서 orderNo/model/status 필터 적용)
  const jobOrders = useMemo<ProductionJobOrderRow[]>(() => {
    const raw = jobOrderData?.data;
    return Array.isArray(raw) ? raw : (raw as JobOrderListResponse)?.data ?? [];
  }, [jobOrderData]);

  // 작업지시 드롭다운 옵션
  const workOrderOptions = useMemo(() => [
    { value: '', label: '전체 작업지시' },
    ...jobOrders.map((j) => ({
      value: j.orderNo,
      label: `${j.orderNo}${j.itemCode ? ` - ${j.itemCode}` : ''}`,
    })),
  ], [jobOrders]);

  return {
    filteredRequests,
    stats,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    searchStockItems,
    loadBomRequestItems,
    loadRequestsByOrder,
    jobOrders,
    isLoadingJobOrders,
    woOrderNo,
    setWoOrderNo,
    woModel,
    setWoModel,
    woStatus,
    setWoStatus,
    workOrderOptions,
    stockItems: [] as StockItem[],
    isLoading,
    refetch,
    invalidate,
    page,
    setPage,
  };
}
