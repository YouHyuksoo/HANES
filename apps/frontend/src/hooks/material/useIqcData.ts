/**
 * @file src/hooks/material/useIqcData.ts
 * @description IQC 수입검사 데이터 훅 - 입하단위(입하번호+품목) 검사 대상 조회 및 시리얼별 검사결과 저장
 *
 * 초보자 가이드:
 * 1. GET /material/iqc-history/pending-arrivals 에서 입하번호+품목 단위로 묶인 검사 대상 조회
 * 2. 모달에서 스캔한 시리얼별 검사항목 판정 결과를 details JSON으로 구성
 * 3. POST /material/iqc-history/arrival 로 입하건 IQC 로그와 시리얼별 상세 결과를 저장
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import type { IqcStatus } from '@/components/material';
import api from '@/services/api';

/** IQC 검사 대상 (입하번호 + 품목 단위 그룹) */
export interface IqcItem {
  /** `${arrivalNo}::${itemCode}` */
  id: string;
  arrivalNo: string;
  itemCode: string;
  itemName: string;
  vendorCode: string;
  supplierName: string;
  /** 이 입하건이 속한 발주(PO) 번호 */
  poNo: string | null;
  /** 입하건 총수량 (SUM INIT_QTY) */
  totalQty: number;
  /** 입하건에 속한 시리얼 수 */
  serialCount: number;
  unit: string;
  /** 검사구분 (FULL/SKIP) — part master 기준 */
  inspectMethod: string | null;
  /** 불량코드 2레벨 모델구분 (DEFECT_MODEL_GROUP) */
  defectModelGroup: string | null;
  arrivalDate: string;
  status: IqcStatus;
  inspector: string | null;
}

/** IQC 검사결과 폼 */
export interface IqcResultForm {
  result: 'PASSED' | 'FAILED' | '';
  inspector: string;
  remark: string;
}

/** IQC 모달 제출 시 부가 정보 */
export interface IqcSubmitExtra {
  sampleQty?: number;
  certFile?: File;
  sampleBarcode?: string;
  defects?: Array<{ defectCode: string; qty: number }>;
}

const INITIAL_RESULT_FORM: IqcResultForm = { result: '', inspector: '', remark: '' };

const formatDebugSql = (debugSql?: { sql?: string; parameters?: Record<string, unknown> }) => {
  if (!debugSql?.sql) return '';
  const parameters = debugSql.parameters && Object.keys(debugSql.parameters).length > 0
    ? `\n\n-- parameters\n-- ${JSON.stringify(debugSql.parameters, null, 2).replace(/\n/g, '\n-- ')}`
    : '';
  return `${debugSql.sql}${parameters}`;
};

/** 백엔드 iqcStatus → 프론트엔드 IqcStatus 매핑 */
const mapToFrontendStatus = (iqcStatus: string): IqcStatus => {
  if (iqcStatus === 'PASS') return 'PASSED';
  if (iqcStatus === 'FAIL') return 'FAILED';
  return iqcStatus as IqcStatus;
};

export function useIqcData() {
  const [items, setItems] = useState<IqcItem[]>([]);
  const [sqlQuery, setSqlQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [isIqcModalOpen, setIsIqcModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IqcItem | null>(null);
  const [resultForm, setResultForm] = useState<IqcResultForm>(INITIAL_RESULT_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/material/iqc-history/pending-arrivals', {
        params: { iqcStatus: 'PENDING' },
      });
      const groups = res.data?.data ?? [];
      setSqlQuery(formatDebugSql(res.data?.meta?.debugSql));
      const mapped: IqcItem[] = groups.map((g: any) => ({
        id: `${g.arrivalNo}::${g.itemCode}`,
        arrivalNo: g.arrivalNo || '-',
        itemCode: g.itemCode || '',
        itemName: g.itemName || '',
        vendorCode: g.vendor || '',
        supplierName: g.vendorName || g.vendor || '-',
        poNo: g.poNo ?? null,
        totalQty: g.totalQty ?? 0,
        serialCount: g.serialCount ?? 0,
        unit: g.unit || 'EA',
        inspectMethod: g.inspectMethod ?? null,
        defectModelGroup: g.defectModelGroup ?? null,
        arrivalDate: g.recvDate || g.createdAt || '',
        status: mapToFrontendStatus(g.iqcStatus || 'PENDING'),
        inspector: null,
      }));
      setItems(mapped);
    } catch {
      setItems([]);
      setSqlQuery('');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchStatus = !statusFilter || item.status === statusFilter;
      const matchMethod = !methodFilter || item.inspectMethod === methodFilter;
      const matchSearch =
        !searchText ||
        item.arrivalNo.toLowerCase().includes(searchText.toLowerCase()) ||
        item.itemName.toLowerCase().includes(searchText.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(searchText.toLowerCase()) ||
        (item.poNo ?? '').toLowerCase().includes(searchText.toLowerCase());
      return matchStatus && matchMethod && matchSearch;
    });
  }, [items, statusFilter, methodFilter, searchText]);

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

  const handleIqcSubmit = useCallback(async (
    details?: unknown,
    overrideResult?: string,
    extra?: IqcSubmitExtra,
  ) => {
    const finalResult = overrideResult || resultForm.result;
    if (!selectedItem || !finalResult) return;
    try {
      const result = finalResult === 'PASSED' ? 'PASS' : 'FAIL';
      const res = await api.post('/material/iqc-history/arrival', {
        arrivalNo: selectedItem.arrivalNo,
        itemCode: selectedItem.itemCode,
        result,
        inspectorName: resultForm.inspector || undefined,
        remark: resultForm.remark || undefined,
        details: details ? JSON.stringify(details) : undefined,
        sampleQty: extra?.sampleQty || undefined,
        sampleBarcode: extra?.sampleBarcode || undefined,
        defects: extra?.defects,
        inspectClass: selectedItem.inspectMethod || undefined,
      });

      // 검사성적서 파일 업로드 (결과 등록 후)
      if (extra?.certFile && res.data?.data) {
        const logData = res.data.data;
        const formData = new FormData();
        formData.append('file', extra.certFile);
        const inspectDate = logData.inspectDate
          ? new Date(logData.inspectDate).toISOString()
          : new Date().toISOString();
        await api.post(
          `/material/iqc-history/${encodeURIComponent(inspectDate)}/${logData.seq}/upload-cert`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        );
      }

      setIsIqcModalOpen(false);
      setSelectedItem(null);
      setResultForm(INITIAL_RESULT_FORM);
      fetchData();
    } catch (e: unknown) {
      console.error('IQC submit failed:', e);
    }
  }, [selectedItem, resultForm, fetchData]);

  return {
    filteredItems,
    sqlQuery,
    stats,
    loading,
    statusFilter, setStatusFilter,
    methodFilter, setMethodFilter,
    searchText, setSearchText,
    isIqcModalOpen, setIsIqcModalOpen,
    selectedItem,
    resultForm, setResultForm,
    openIqcModal,
    handleIqcSubmit,
    refresh: fetchData,
  };
}
