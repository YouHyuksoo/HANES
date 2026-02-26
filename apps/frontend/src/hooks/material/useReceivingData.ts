/**
 * @file src/pages/material/receiving/hooks/useReceivingData.ts
 * @description 입고관리 데이터 훅 - IQC 합격건 입고확정 처리
 *
 * 초보자 가이드:
 * 1. **입고확정**: IQC 합격(PASSED) 건을 수동으로 입고 확정 → 재고 증가
 * 2. **상태 변경**: PASSED(합격) → STOCKED(입고완료)
 * 3. **창고 지정**: 입고확정 시 창고 및 보관위치 선택
 */
import { useState, useMemo } from 'react';
import type { ReceivingStatus } from '@/components/material';

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

/** Mock 데이터 - IQC 합격건 */
const mockReceivingItems: ReceivingItem[] = [
  { id: '1', receiveNo: 'RCV-20250126-001', arrivalDate: '2025-01-26', supplierName: '삼성커넥터', itemCode: 'CONN-001', itemName: '커넥터 6핀', matUid: 'MAT-20250125-C01', quantity: 2000, unit: 'EA', status: 'PASSED', iqcPassedAt: '2025-01-25 14:30', stockedAt: null, warehouse: null, location: null },
  { id: '2', receiveNo: 'RCV-20250126-002', arrivalDate: '2025-01-26', supplierName: '한국단자', itemCode: 'TERM-002', itemName: '단자 250형', matUid: 'MAT-20250124-B02', quantity: 8000, unit: 'EA', status: 'PASSED', iqcPassedAt: '2025-01-24 11:00', stockedAt: null, warehouse: null, location: null },
  { id: '3', receiveNo: 'RCV-20250125-003', arrivalDate: '2025-01-25', supplierName: '대한전선', itemCode: 'WIRE-001', itemName: 'AWG18 적색', matUid: 'MAT-20250123-A01', quantity: 5000, unit: 'M', status: 'STOCKED', iqcPassedAt: '2025-01-23 10:00', stockedAt: '2025-01-24 09:00', warehouse: '자재창고A', location: 'A-01-01' },
  { id: '4', receiveNo: 'RCV-20250125-004', arrivalDate: '2025-01-25', supplierName: '한국단자', itemCode: 'TERM-001', itemName: '단자 110형', matUid: 'MAT-20250123-B01', quantity: 10000, unit: 'EA', status: 'STOCKED', iqcPassedAt: '2025-01-23 15:00', stockedAt: '2025-01-24 10:00', warehouse: '자재창고B', location: 'B-02-01' },
  { id: '5', receiveNo: 'RCV-20250126-005', arrivalDate: '2025-01-26', supplierName: '삼성커넥터', itemCode: 'CONN-002', itemName: '커넥터 12핀', matUid: 'MAT-20250126-C02', quantity: 1500, unit: 'EA', status: 'PASSED', iqcPassedAt: '2025-01-26 09:00', stockedAt: null, warehouse: null, location: null },
];

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
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReceivingItem | null>(null);
  const [confirmForm, setConfirmForm] = useState<ReceivingConfirmForm>(INITIAL_FORM);

  const filteredItems = useMemo(() => {
    return mockReceivingItems.filter((item) => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchSearch =
        !searchText ||
        item.receiveNo.toLowerCase().includes(searchText.toLowerCase()) ||
        item.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
        item.matUid.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [statusFilter, searchText]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const pendingItems = mockReceivingItems.filter((i) => i.status === 'PASSED');
    const todayStocked = mockReceivingItems.filter(
      (i) => i.status === 'STOCKED' && i.stockedAt?.startsWith(today)
    );
    return {
      pendingCount: pendingItems.length,
      pendingQty: pendingItems.reduce((sum, i) => sum + i.quantity, 0),
      todayStockedCount: todayStocked.length,
      todayStockedQty: todayStocked.reduce((sum, i) => sum + i.quantity, 0),
    };
  }, []);

  const openConfirmModal = (item: ReceivingItem) => {
    setSelectedItem(item);
    setConfirmForm(INITIAL_FORM);
    setIsConfirmModalOpen(true);
  };

  const handleConfirm = () => {
    console.log('입고확정:', selectedItem?.receiveNo, confirmForm);
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
