/**
 * @file src/pages/material/arrival/hooks/useArrivalData.ts
 * @description 입하관리 데이터 훅 - 입하 목록 조회 및 등록 처리
 *
 * 초보자 가이드:
 * 1. **입하**: 공급업체에서 자재가 도착하면 가입고(입하) 등록
 * 2. **상태**: ARRIVED(입하완료), IQC_READY(IQC대기)
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
}

export const supplierOptions = [
  { value: '', label: '전체 공급업체' },
  { value: '대한전선', label: '대한전선' },
  { value: '한국단자', label: '한국단자' },
  { value: '삼성커넥터', label: '삼성커넥터' },
];

export function useArrivalData() {
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArrivalCreateForm>(INITIAL_FORM);

  useEffect(() => {
    let cancelled = false;

    async function fetchArrivals() {
      try {
        const response = await api.get<PagedResponse<ArrivalApiRow>>('/material/arrivals', {
          params: { limit: 200 },
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

        if (!cancelled) setArrivals(rows);
      } catch {
        if (!cancelled) setArrivals([]);
      }
    }

    fetchArrivals();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredArrivals = useMemo(() => {
    return arrivals.filter((r) => {
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchSupplier = !supplierFilter || r.supplierName === supplierFilter;
      const matchSearch =
        !searchText ||
        r.arrivalNo.toLowerCase().includes(searchText.toLowerCase()) ||
        r.itemName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSupplier && matchSearch;
    });
  }, [arrivals, statusFilter, supplierFilter, searchText]);

  const stats = useMemo(() => {
    const today = getTodayLocal();
    const todayItems = arrivals.filter((r) => r.arrivalDate === today);
    return {
      todayCount: todayItems.length,
      pendingCount: arrivals.filter((r) => r.status === 'ARRIVED').length,
      todayQty: todayItems.reduce((sum, r) => sum + r.quantity, 0),
      totalCount: arrivals.length,
    };
  }, [arrivals]);

  const handleCreate = () => {
    setIsCreateModalOpen(false);
    setCreateForm(INITIAL_FORM);
  };

  return {
    filteredArrivals,
    stats,
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
