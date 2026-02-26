/**
 * @file src/pages/material/arrival/hooks/useArrivalData.ts
 * @description 입하관리 데이터 훅 - 입하 목록 조회 및 등록 처리
 *
 * 초보자 가이드:
 * 1. **입하**: 공급업체에서 자재가 도착하면 가입고(입하) 등록
 * 2. **상태**: ARRIVED(입하완료), IQC_READY(IQC대기)
 */
import { useState, useMemo } from 'react';
import type { ArrivalStatus } from '@/components/material';

/** 입하 자재 인터페이스 */
export interface ArrivalItem {
  id: string;
  arrivalNo: string;
  arrivalDate: string;
  supplierName: string;
  itemCode: string;
  itemName: string;
  lotNo: string;
  quantity: number;
  unit: string;
  status: ArrivalStatus;
  remark: string | null;
}

/** 입하 등록 폼 */
export interface ArrivalCreateForm {
  supplier: string;
  itemCode: string;
  lotNo: string;
  quantity: string;
  remark: string;
}

const INITIAL_FORM: ArrivalCreateForm = {
  supplier: '',
  itemCode: '',
  lotNo: '',
  quantity: '',
  remark: '',
};

/** Mock 데이터 */
const mockArrivals: ArrivalItem[] = [
  { id: '1', arrivalNo: 'ARR-20250126-001', arrivalDate: '2025-01-26', supplierName: '대한전선', itemCode: 'WIRE-001', itemName: 'AWG18 적색', lotNo: 'L20250126-A01', quantity: 5000, unit: 'M', status: 'ARRIVED', remark: null },
  { id: '2', arrivalNo: 'ARR-20250126-002', arrivalDate: '2025-01-26', supplierName: '한국단자', itemCode: 'TERM-001', itemName: '단자 110형', lotNo: 'L20250126-B01', quantity: 10000, unit: 'EA', status: 'IQC_READY', remark: null },
  { id: '3', arrivalNo: 'ARR-20250125-001', arrivalDate: '2025-01-25', supplierName: '삼성커넥터', itemCode: 'CONN-001', itemName: '커넥터 6핀', lotNo: 'L20250125-C01', quantity: 2000, unit: 'EA', status: 'IQC_READY', remark: '긴급 입하' },
  { id: '4', arrivalNo: 'ARR-20250125-002', arrivalDate: '2025-01-25', supplierName: '대한전선', itemCode: 'WIRE-002', itemName: 'AWG20 흑색', lotNo: 'L20250125-A02', quantity: 3000, unit: 'M', status: 'ARRIVED', remark: null },
  { id: '5', arrivalNo: 'ARR-20250124-001', arrivalDate: '2025-01-24', supplierName: '한국단자', itemCode: 'TERM-002', itemName: '단자 250형', lotNo: 'L20250124-B02', quantity: 8000, unit: 'EA', status: 'IQC_READY', remark: null },
];

export const supplierOptions = [
  { value: '', label: '전체 공급업체' },
  { value: '대한전선', label: '대한전선' },
  { value: '한국단자', label: '한국단자' },
  { value: '삼성커넥터', label: '삼성커넥터' },
];

export function useArrivalData() {
  const [statusFilter, setStatusFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ArrivalCreateForm>(INITIAL_FORM);

  const filteredArrivals = useMemo(() => {
    return mockArrivals.filter((r) => {
      const matchStatus = !statusFilter || r.status === statusFilter;
      const matchSupplier = !supplierFilter || r.supplierName === supplierFilter;
      const matchSearch =
        !searchText ||
        r.arrivalNo.toLowerCase().includes(searchText.toLowerCase()) ||
        r.itemName.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSupplier && matchSearch;
    });
  }, [statusFilter, supplierFilter, searchText]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = mockArrivals.filter((r) => r.arrivalDate === today);
    return {
      todayCount: todayItems.length,
      pendingCount: mockArrivals.filter((r) => r.status === 'ARRIVED').length,
      todayQty: todayItems.reduce((sum, r) => sum + r.quantity, 0),
      totalCount: mockArrivals.length,
    };
  }, []);

  const handleCreate = () => {
    console.log('입하 등록:', createForm);
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
