/**
 * @file src/hooks/material/useIqcData.ts
 * @description IQC 수입검사 데이터 훅 - API 연동 (검사 대상 조회 및 결과 등록)
 *
 * 초보자 가이드:
 * 1. GET /material/lots 에서 LOT 목록 조회
 * 2. POST /material/iqc-history 로 검사결과 등록 + LOT 상태 업데이트
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import type { IqcStatus } from '@/components/material';
import api from '@/services/api';

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

/** 백엔드 iqcStatus → 프론트엔드 IqcStatus 매핑 */
const mapToFrontendStatus = (iqcStatus: string): IqcStatus => {
  if (iqcStatus === 'PASS') return 'PASSED';
  if (iqcStatus === 'FAIL') return 'FAILED';
  return iqcStatus as IqcStatus;
};

export function useIqcData() {
  const [items, setItems] = useState<IqcItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isIqcModalOpen, setIsIqcModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IqcItem | null>(null);
  const [resultForm, setResultForm] = useState<IqcResultForm>(INITIAL_RESULT_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/material/lots', { params: { limit: 5000 } });
      const lots = res.data?.data ?? [];
      const mapped: IqcItem[] = lots.map((lot: any) => ({
        id: lot.id,
        receiveNo: lot.lotNo || '-',
        arrivalDate: lot.createdAt || '',
        supplierName: lot.vendor || '-',
        partCode: lot.partCode || '',
        partName: lot.partName || '',
        lotNo: lot.lotNo || '',
        quantity: lot.currentQty ?? 0,
        unit: lot.unit || 'EA',
        status: mapToFrontendStatus(lot.iqcStatus || 'PENDING'),
        inspector: null,
        inspectedAt: null,
        remark: null,
      }));
      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchSearch =
        !searchText ||
        item.receiveNo.toLowerCase().includes(searchText.toLowerCase()) ||
        item.partName.toLowerCase().includes(searchText.toLowerCase()) ||
        item.lotNo.toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [items, statusFilter, searchText]);

  const stats = useMemo(() => ({
    pending: items.filter((i) => i.status === 'PENDING').length,
    inProgress: items.filter((i) => i.status === 'IQC_IN_PROGRESS').length,
    passed: items.filter((i) => i.status === 'PASSED').length,
    failed: items.filter((i) => i.status === 'FAILED').length,
  }), [items]);

  const openIqcModal = (item: IqcItem) => {
    setSelectedItem(item);
    setResultForm(INITIAL_RESULT_FORM);
    setIsIqcModalOpen(true);
  };

  const handleIqcSubmit = useCallback(async (details?: any[]) => {
    if (!selectedItem || !resultForm.result) return;
    try {
      const result = resultForm.result === 'PASSED' ? 'PASS' : 'FAIL';
      await api.post('/material/iqc-history', {
        lotId: selectedItem.id,
        result,
        inspectorName: resultForm.inspector || undefined,
        remark: resultForm.remark || undefined,
        details: details ? JSON.stringify(details) : undefined,
      });
      setIsIqcModalOpen(false);
      setSelectedItem(null);
      setResultForm(INITIAL_RESULT_FORM);
      fetchData();
    } catch (e) {
      console.error('IQC submit failed:', e);
    }
  }, [selectedItem, resultForm, fetchData]);

  return {
    filteredItems,
    stats,
    loading,
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    isIqcModalOpen, setIsIqcModalOpen,
    selectedItem,
    resultForm, setResultForm,
    openIqcModal,
    handleIqcSubmit,
    refresh: fetchData,
  };
}
