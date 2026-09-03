/**
 * @file src/hooks/material/useBarcodeScan.ts
 * @description 바코드 스캔 출고 훅 - LOT번호 스캔 → 조회 → 전량출고
 *
 * 초보자 가이드:
 * 1. **handleScan**: 입력된 LOT번호로 LOT 정보 조회 (GET)
 * 2. **handleIssue**: 스캔된 LOT를 전량 출고 처리 (POST /material/issues/scan)
 *    - 출고 수량은 백엔드가 승인/부분출고 상태 출고요청에 자동 배분(작업지시 → 공정 → FIFO)
 *    - orderNo 지정 시 MAT_ISSUES.ORDER_NO 기록 + 해당 작업지시 요청 우선 배분
 * 3. **handleCancel**: 스캔 결과 초기화 (다음 스캔 준비)
 * 4. **scanHistory**: 금일 스캔 출고 이력 (로컬 상태, 배분된 요청번호 포함)
 * 5. **error**: LOT 조회 실패 또는 출고 처리 실패 메시지
 */
import { useState, useCallback } from 'react';
import { api } from '@/services/api';
import { useInvalidateQueries } from '@/hooks/useApi';

/** 스캔된 LOT 정보 */
export interface ScannedLot {
  id: string;
  matUid: string;
  itemCode: string;
  itemName: string;
  qty: number;
  remainQty: number;
  unit: string;
  iqcStatus: string;
  warehouseCode: string;
  warehouseName: string;
  supplierName?: string;
}

/** 스캔 출고 응답의 출고요청 배분 결과 (백엔드 IssueRequestAllocationService) */
export interface ScanIssueAllocation {
  allocations: Array<{
    requestNo: string;
    seq: number;
    orderNo: string | null;
    allocatedQty: number;
    requestStatus: 'PARTIAL' | 'COMPLETED';
  }>;
  allocatedQty: number;
  unallocatedQty: number;
}

/** 스캔 출고 이력 */
export interface ScanHistoryItem {
  matUid: string;
  itemCode: string;
  itemName: string;
  issueQty: number;
  unit: string;
  issuedAt: string;
  /** 배분된 출고요청 번호 목록 (무매칭이면 빈 배열) */
  allocatedRequestNos: string[];
  /** 매칭 요청이 없어 배분되지 않은 수량 */
  unallocatedQty: number;
}

/**
 * 바코드 스캔 출고 훅
 * - LOT번호 입력 → 조회 → 결과 표시
 * - 전량출고 → 이력 추가 → 다음 스캔 준비
 */
export function useBarcodeScan() {
  const invalidate = useInvalidateQueries();
  const [scanInput, setScanInput] = useState('');
  const [issueType, setIssueType] = useState<string>('PRODUCTION');
  const [processCode, setProcessCode] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [scannedLot, setScannedLot] = useState<ScannedLot | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 자재UID로 조회
  const handleScan = useCallback(async (rawMatUid?: string) => {
    const matUid = (rawMatUid ?? scanInput).replace(/\r?\n|\r/g, '').trim();
    if (!matUid) return;

    setIsScanning(true);
    setError(null);
    try {
      const res = await api.get(`/material/lots/by-uid/${encodeURIComponent(matUid)}`);
      const lotData = res.data?.data ?? res.data;
      setScannedLot(lotData);
      setScanInput(matUid);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || 'LOT 조회에 실패했습니다.');
      setScannedLot(null);
    } finally {
      setIsScanning(false);
    }
  }, [scanInput]);

  // 전량출고 처리
  const handleIssue = useCallback(async () => {
    if (!scannedLot) return;
    if (!processCode.trim()) {
      setError('출고 공정을 선택하세요.');
      return;
    }

    setError(null);
    try {
      const res = await api.post('/material/issues/scan', {
        matUid: scannedLot.matUid,
        issueType,
        processCode: processCode.trim(),
        orderNo: orderNo.trim() || undefined,
      });
      const issueData = res.data?.data ?? res.data;
      const allocation = (issueData?.allocation ?? null) as ScanIssueAllocation | null;

      // 이력 추가 (최신순)
      setScanHistory((prev) => [
        {
          matUid: scannedLot.matUid,
          itemCode: scannedLot.itemCode,
          itemName: scannedLot.itemName,
          issueQty: issueData?.issuedQty ?? issueData?.issueQty ?? scannedLot.remainQty ?? scannedLot.qty,
          unit: scannedLot.unit ?? 'EA',
          issuedAt: new Date().toISOString(),
          allocatedRequestNos: [...new Set((allocation?.allocations ?? []).map((a) => a.requestNo))],
          unallocatedQty: allocation?.unallocatedQty ?? 0,
        },
        ...prev,
      ]);

      // 출고요청 그리드(ISSUED_QTY/상태) 갱신
      invalidate(['issue-requests']);
      invalidate(['issue-request-detail']);

      // 초기화 (다음 스캔 준비)
      setScannedLot(null);
      setScanInput('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || '출고 처리에 실패했습니다.');
    }
  }, [scannedLot, issueType, processCode, orderNo, invalidate]);

  // 스캔 결과 취소
  const handleCancel = useCallback(() => {
    setScannedLot(null);
    setScanInput('');
    setError(null);
  }, []);

  return {
    scanInput,
    setScanInput,
    issueType,
    setIssueType,
    processCode,
    setProcessCode,
    orderNo,
    setOrderNo,
    scannedLot,
    scanHistory,
    isScanning,
    error,
    handleScan,
    handleIssue,
    handleCancel,
  };
}
