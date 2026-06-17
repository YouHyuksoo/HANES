/**
 * @file src/pages/material/receiving/hooks/useReceivingData.ts
 * @description 입고관리 데이터 훅 - IQC 합격건 입고확정 처리
 *
 * 초보자 가이드:
 * 1. **입고확정**: IQC 합격(PASSED) 건을 수동으로 입고 확정 → 재고 증가
 * 2. **상태 변경**: PASSED(합격) → STOCKED(입고완료)
 * 3. **창고 지정**: 입고확정 시 창고 및 보관위치 선택
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReceivingStatus } from '@/components/material';
import { api } from '@/services/api';
import { getTodayLocal } from '@/utils/date';

/** 입고 대상 항목 인터페이스 */
export interface ReceivingItem {
  id: string;
  receiveNo: string;
  arrivalDate: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  matUid: string;
  quantity: number;
  unit: string;
  status: ReceivingStatus;
  iqcPassedAt: string;
  stockedAt: string | null;
  warehouse: string | null;
  location: string | null;
}

/** 입고확정 폼 */
export interface ReceivingConfirmForm {
  warehouse: string;
  location: string;
  remark: string;
}

const INITIAL_FORM: ReceivingConfirmForm = { warehouse: '', location: '', remark: '' };

interface ReceivingApiRow {
  receiveNo?: string;
  transNo?: string;
  transDate?: string;
  qty?: number;
  status?: string;
  part?: { itemCode?: string; itemName?: string; unit?: string } | null;
  lot?: { matUid?: string; poNo?: string } | null;
  toWarehouse?: { warehouseName?: string } | null;
}

interface ReceivableApiRow {
  matUid?: string;
  itemCode?: string;
  initQty?: number;
  remainingQty?: number;
  createdAt?: string;
  iqcStatus?: string;
  part?: { itemName?: string; unit?: string } | null;
  arrivalWarehouseName?: string | null;
}

interface PagedResponse<T> {
  data?: T[];
}

interface ApiResponse<T> {
  data?: T;
}

export const warehouseOptions = [
  { value: '', label: '창고 선택' },
  { value: '자재창고A', label: '자재창고A' },
  { value: '자재창고B', label: '자재창고B' },
  { value: '부자재창고', label: '부자재창고' },
];

export const statusFilterOptions = [
  { value: '', label: '전체 상태' },
  { value: 'PASSED', label: '입고대기' },
  { value: 'STOCKED', label: '입고완료' },
];

export function useReceivingData() {
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReceivingItem | null>(null);
  const [confirmForm, setConfirmForm] = useState<ReceivingConfirmForm>(INITIAL_FORM);

  useEffect(() => {
    let cancelled = false;

    async function fetchReceivingItems() {
      try {
        const [receivableResponse, historyResponse] = await Promise.all([
          api.get<ApiResponse<ReceivableApiRow[]>>('/material/receiving/receivable'),
          api.get<PagedResponse<ReceivingApiRow>>('/material/receiving', { params: { limit: 200 } }),
        ]);

        const receivableRows = (receivableResponse.data?.data ?? []).map((row, index) => ({
          id: row.matUid ?? `receivable-${index}`,
          receiveNo: row.matUid ?? '',
          arrivalDate: row.createdAt ? String(row.createdAt).slice(0, 10) : '',
          supplierName: '',
          itemCode: row.itemCode ?? row.part?.itemName ?? '',
          itemName: row.part?.itemName ?? row.itemCode ?? '',
          matUid: row.matUid ?? '',
          quantity: row.remainingQty ?? row.initQty ?? 0,
          unit: row.part?.unit ?? '',
          status: 'PASSED' as ReceivingStatus,
          iqcPassedAt: row.createdAt ? String(row.createdAt).slice(0, 16).replace('T', ' ') : '',
          stockedAt: null,
          warehouse: row.arrivalWarehouseName ?? null,
          location: null,
        }));

        const historyRows = (historyResponse.data?.data ?? []).map((row, index) => ({
          id: `${row.receiveNo ?? row.transNo ?? 'received'}-${index}`,
          receiveNo: row.receiveNo ?? row.transNo ?? '',
          arrivalDate: row.transDate ? String(row.transDate).slice(0, 10) : '',
          supplierName: '',
          itemCode: row.part?.itemCode ?? '',
          itemName: row.part?.itemName ?? row.part?.itemCode ?? '',
          matUid: row.lot?.matUid ?? '',
          quantity: row.qty ?? 0,
          unit: row.part?.unit ?? '',
          status: 'STOCKED' as ReceivingStatus,
          iqcPassedAt: '',
          stockedAt: row.transDate ? String(row.transDate).slice(0, 16).replace('T', ' ') : null,
          warehouse: row.toWarehouse?.warehouseName ?? null,
          location: null,
        }));

        if (!cancelled) setItems([...receivableRows, ...historyRows]);
      } catch {
        if (!cancelled) setItems([]);
      }
    }

    fetchReceivingItems();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchSearch =
        !searchText ||
        item.receiveNo.toLowerCase().includes(searchText.toLowerCase()) ||
        item.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
        item.matUid.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [items, statusFilter, searchText]);

  const stats = useMemo(() => {
    const today = getTodayLocal();
    const pendingItems = items.filter((i) => i.status === 'PASSED');
    const todayStocked = items.filter(
      (i) => i.status === 'STOCKED' && i.stockedAt?.startsWith(today)
    );
    return {
      pendingCount: pendingItems.length,
      pendingQty: pendingItems.reduce((sum, i) => sum + i.quantity, 0),
      todayStockedCount: todayStocked.length,
      todayStockedQty: todayStocked.reduce((sum, i) => sum + i.quantity, 0),
    };
  }, [items]);

  const openConfirmModal = (item: ReceivingItem) => {
    setSelectedItem(item);
    setConfirmForm(INITIAL_FORM);
    setIsConfirmModalOpen(true);
  };

  const handleConfirm = () => {
    setIsConfirmModalOpen(false);
    setSelectedItem(null);
    setConfirmForm(INITIAL_FORM);
  };

  return {
    filteredItems,
    stats,
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    isConfirmModalOpen, setIsConfirmModalOpen,
    selectedItem,
    confirmForm, setConfirmForm,
    openConfirmModal,
    handleConfirm,
  };
}
