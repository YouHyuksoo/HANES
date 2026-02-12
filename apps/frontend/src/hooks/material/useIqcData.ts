/**
 * @file src/pages/material/iqc/hooks/useIqcData.ts
 * @description IQC 수입검사 데이터 훅 - 검사 대상 조회 및 결과 등록
 *
 * 초보자 가이드:
 * 1. **IQC 대상**: PENDING(대기), IQC_IN_PROGRESS(검사중) 상태 건
 * 2. **검사 결과**: PASSED(합격), FAILED(불합격)
 */
import { useState, useMemo } from 'react';
import type { IqcStatus } from '@/components/material';

/** IQC 검사 항목 인터페이스 */
export interface IqcItem {
  id: string;
  receiveNo: string;
  arrivalDate: string;
  supplierName: string;
  partCode: string;
  partName: string;
  lotNo: string;
  quantity: number;
  unit: string;
  status: IqcStatus;
  inspector: string | null;
  inspectedAt: string | null;
  remark: string | null;
}

/** IQC 검사결과 폼 */
export interface IqcResultForm {
  result: 'PASSED' | 'FAILED' | '';
  inspector: string;
  remark: string;
}

const INITIAL_RESULT_FORM: IqcResultForm = { result: '', inspector: '', remark: '' };

/** Mock 데이터 */
const mockIqcItems: IqcItem[] = [
  { id: '1', receiveNo: 'RCV-20250126-001', arrivalDate: '2025-01-26', supplierName: '대한전선', partCode: 'WIRE-001', partName: 'AWG18 적색', lotNo: 'L20250126-A01', quantity: 5000, unit: 'M', status: 'PENDING', inspector: null, inspectedAt: null, remark: null },
  { id: '2', receiveNo: 'RCV-20250126-002', arrivalDate: '2025-01-26', supplierName: '한국단자', partCode: 'TERM-001', partName: '단자 110형', lotNo: 'L20250126-B01', quantity: 10000, unit: 'EA', status: 'IQC_IN_PROGRESS', inspector: '김검사', inspectedAt: null, remark: null },
  { id: '3', receiveNo: 'RCV-20250125-001', arrivalDate: '2025-01-25', supplierName: '삼성커넥터', partCode: 'CONN-001', partName: '커넥터 6핀', lotNo: 'L20250125-C01', quantity: 2000, unit: 'EA', status: 'PASSED', inspector: '이검사', inspectedAt: '2025-01-25 14:30', remark: '합격' },
  { id: '4', receiveNo: 'RCV-20250125-002', arrivalDate: '2025-01-25', supplierName: '대한전선', partCode: 'WIRE-002', partName: 'AWG20 흑색', lotNo: 'L20250125-A02', quantity: 3000, unit: 'M', status: 'FAILED', inspector: '박검사', inspectedAt: '2025-01-25 16:00', remark: '외관불량' },
  { id: '5', receiveNo: 'RCV-20250124-001', arrivalDate: '2025-01-24', supplierName: '한국단자', partCode: 'TERM-002', partName: '단자 250형', lotNo: 'L20250124-B02', quantity: 8000, unit: 'EA', status: 'PASSED', inspector: '김검사', inspectedAt: '2025-01-24 11:00', remark: null },
  { id: '6', receiveNo: 'RCV-20250126-003', arrivalDate: '2025-01-26', supplierName: '삼성커넥터', partCode: 'CONN-002', partName: '커넥터 12핀', lotNo: 'L20250126-C02', quantity: 1500, unit: 'EA', status: 'PENDING', inspector: null, inspectedAt: null, remark: null },
];

export function useIqcData() {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isIqcModalOpen, setIsIqcModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IqcItem | null>(null);
  const [resultForm, setResultForm] = useState<IqcResultForm>(INITIAL_RESULT_FORM);

  const filteredItems = useMemo(() => {
    return mockIqcItems.filter((item) => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchSearch =
        !searchText ||
        item.receiveNo.toLowerCase().includes(searchText.toLowerCase()) ||
        item.partName.toLowerCase().includes(searchText.toLowerCase()) ||
        item.lotNo.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [statusFilter, searchText]);

  const stats = useMemo(() => ({
    pending: mockIqcItems.filter((i) => i.status === 'PENDING').length,
    inProgress: mockIqcItems.filter((i) => i.status === 'IQC_IN_PROGRESS').length,
    passed: mockIqcItems.filter((i) => i.status === 'PASSED').length,
    failed: mockIqcItems.filter((i) => i.status === 'FAILED').length,
  }), []);

  const openIqcModal = (item: IqcItem) => {
    setSelectedItem(item);
    setResultForm(INITIAL_RESULT_FORM);
    setIsIqcModalOpen(true);
  };

  const handleIqcSubmit = () => {
    console.log('IQC 결과:', selectedItem?.receiveNo, resultForm);
    setIsIqcModalOpen(false);
    setSelectedItem(null);
    setResultForm(INITIAL_RESULT_FORM);
  };

  return {
    filteredItems,
    stats,
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    isIqcModalOpen, setIsIqcModalOpen,
    selectedItem,
    resultForm, setResultForm,
    openIqcModal,
    handleIqcSubmit,
  };
}
