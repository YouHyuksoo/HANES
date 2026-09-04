/**
 * @file src/hooks/material/useArrivalData.ts
 * @description 입하 이력(MAT_ARRIVAL_TRANSACTIONS) 데이터 훅 - 입하 목록 조회 및 등록 폼 상태
 *
 * 초보자 가이드:
 * 1. **입하**: 공급업체에서 자재가 도착하면 가입고(입하) 등록
 * 2. **상태**: ARRIVED(입하완료), IQC_READY(IQC대기)
 * 3. **목록 조건**: 이력성 데이터라 입하일 구간(기본 당일)이 항상 붙는다. 상태/검색어도 서버 파라미터로 보낸다.
 *    (전량을 받아 클라이언트에서 거르지 않는다 — 조건 없는 전량 조회 금지)
 *
 * 참고: 입하관리 화면(material/arrival/page.tsx)은 PO 라인 API(/material/arrivals/po-lines)를 직접 쓰며
 *       이 훅은 입하 이력 테이블/모달(components/material/ArrivalTable·ArrivalModal) 타입의 출처다.
 */
import { useEffect, useMemo, useState } from 'react';
import type { ArrivalStatus } from '@/components/material';
import { api } from '@/services/api';
import { getTodayLocal } from '@/utils/date';

/** 입하 자재 인터페이스 */
export interface ArrivalItem {
  id: string;
  arrivalNo: string;
  arrivalDate: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  supUid: string;
  invoiceNo: string;
  quantity: number;
  unit: string;
  status: ArrivalStatus;
  iqcStatus: string;
  remark: string | null;
}

/** 입하 등록 폼 */
export interface ArrivalCreateForm {
  supplier: string;
  itemCode: string;
  supUid: string;
  quantity: string;
  remark: string;
}

const INITIAL_FORM: ArrivalCreateForm = {
  supplier: '',
  itemCode: '',
  supUid: '',
  quantity: '',
  remark: '',
};

interface ArrivalApiRow {
  transNo?: string;
  transDate?: string;
  arrivalNo?: string;
  vendorName?: string;
  itemCode?: string;
  itemName?: string | null;
  matUid?: string | null;
  invoiceNo?: string | null;
  qty?: number;
  unit?: string | null;
  status?: string;
  remark?: string | null;
}

interface PagedResponse<T> {
  data?: T[];
  meta?: { total?: number };
}

/** 서버 페이지당 건수 */
const PAGE_SIZE = 100;

/** 화면 상태(ARRIVED/IQC_READY) → 서버 트랜잭션 상태(CANCELED/DONE) 매핑 */
const SERVER_STATUS_BY_UI_STATUS: Record<string, string> = {
  ARRIVED: 'CANCELED',
  IQC_READY: 'DONE',
};

export const supplierOptions = [
  { value: '', label: '전체 공급업체' },
  { value: '대한전선', label: '대한전선' },
  { value: '한국단자', label: '한국단자' },
  { value: '삼성커넥터', label: '삼성커넥터' },
];

export function useArrivalData() {
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  // 이력성 목록 — 입하일 구간은 필수, 기본 당일
  const [fromDate, setFromDate] = useState(() => getTodayLocal());
  const [toDate, setToDate] = useState(() => getTodayLocal());
  const [page, setPage] = useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArrivalCreateForm>(INITIAL_FORM);

  useEffect(() => { setPage(1); }, [statusFilter, searchText, fromDate, toDate]);

  useEffect(() => {
    let cancelled = false;

    async function fetchArrivals() {
      try {
        const response = await api.get<PagedResponse<ArrivalApiRow>>('/material/arrivals', {
          params: {
            page,
            limit: PAGE_SIZE,
            ...(fromDate && { fromDate }),
            ...(toDate && { toDate }),
            ...(statusFilter && SERVER_STATUS_BY_UI_STATUS[statusFilter] && { status: SERVER_STATUS_BY_UI_STATUS[statusFilter] }),
            ...(searchText && { search: searchText }),
          },
        });
        const rows = (response.data?.data ?? []).map((row, index) => ({
          id: row.transNo ?? row.arrivalNo ?? String(index),
          arrivalNo: row.arrivalNo ?? row.transNo ?? '',
          arrivalDate: row.transDate ? String(row.transDate).slice(0, 10) : '',
          supplierName: row.vendorName ?? '',
          itemCode: row.itemCode ?? '',
          itemName: row.itemName ?? row.itemCode ?? '',
          supUid: row.matUid ?? '',
          invoiceNo: row.invoiceNo ?? '',
          quantity: row.qty ?? 0,
          unit: row.unit ?? '',
          status: row.status === 'CANCELED' ? 'ARRIVED' : 'IQC_READY' as ArrivalStatus,
          iqcStatus: 'PENDING',
          remark: row.remark ?? null,
        }));

        if (!cancelled) {
          setArrivals(rows);
          setTotal(response.data?.meta?.total ?? rows.length);
        }
      } catch {
        if (!cancelled) {
          setArrivals([]);
          setTotal(0);
        }
      }
    }

    fetchArrivals();

    return () => {
      cancelled = true;
    };
  }, [page, fromDate, toDate, statusFilter, searchText]);

  // 공급업체는 서버 파라미터가 없어 날짜 구간으로 한정된 현재 페이지 안에서만 보정한다.
  const filteredArrivals = useMemo(() => {
    if (!supplierFilter) return arrivals;
    return arrivals.filter((r) => r.supplierName === supplierFilter);
  }, [arrivals, supplierFilter]);

  const stats = useMemo(() => {
    const today = getTodayLocal();
    const todayItems = arrivals.filter((r) => r.arrivalDate === today);
    return {
      todayCount: todayItems.length,
      pendingCount: arrivals.filter((r) => r.status === 'ARRIVED').length,
      todayQty: todayItems.reduce((sum, r) => sum + r.quantity, 0),
      totalCount: total,
    };
  }, [arrivals, total]);

  const handleCreate = () => {
    setIsCreateModalOpen(false);
    setCreateForm(INITIAL_FORM);
  };

  return {
    filteredArrivals,
    stats,
    total,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    statusFilter,
    setStatusFilter,
    supplierFilter,
    setSupplierFilter,
    searchText,
    setSearchText,
    isCreateModalOpen,
    setIsCreateModalOpen,
    createForm,
    setCreateForm,
    handleCreate,
  };
}
