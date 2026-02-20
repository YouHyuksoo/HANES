/**
 * @file src/hooks/material/useBarcodeScan.ts
 * @description 바코드 스캔 출고 훅 - LOT번호 스캔 → 조회 → 전량출고
 *
 * 초보자 가이드:
 * 1. **handleScan**: 입력된 LOT번호로 LOT 정보 조회 (GET)
 * 2. **handleIssue**: 스캔된 LOT를 전량 출고 처리 (POST /material/issues/scan)
 * 3. **handleCancel**: 스캔 결과 초기화 (다음 스캔 준비)
 * 4. **scanHistory**: 금일 스캔 출고 이력 (로컬 상태)
 * 5. **error**: LOT 조회 실패 또는 출고 처리 실패 메시지
 */
import { useState, useCallback } from 'react';
import { api } from '@/services/api';

/** 스캔된 LOT 정보 */
export interface ScannedLot {
  id: string;
  lotNo: string;
  partCode: string;
  partName: string;
  qty: number;
  remainQty: number;
  unit: string;
  iqcStatus: string;
  warehouseCode: string;
  warehouseName: string;
  supplierName?: string;
}

/** 스캔 출고 이력 */
export interface ScanHistoryItem {
  lotNo: string;
  partCode: string;
  partName: string;
  issueQty: number;
  unit: string;
  issuedAt: string;
}

/**
 * 바코드 스캔 출고 훅
 * - LOT번호 입력 → 조회 → 결과 표시
 * - 전량출고 → 이력 추가 → 다음 스캔 준비
 */
export function useBarcodeScan() {
  const [scanInput, setScanInput] = useState('');
  const [scannedLot, setScannedLot] = useState<ScannedLot | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // LOT번호로 조회
  const handleScan = useCallback(async () => {
    const lotNo = scanInput.trim();
    if (!lotNo) return;

    setIsScanning(true);
    setError(null);
    try {
      const res = await api.get(`/material/lots/by-lotno/${encodeURIComponent(lotNo)}`);
      const lotData = res.data?.data ?? res.data;
      setScannedLot(lotData);
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

    setError(null);
    try {
      const res = await api.post('/material/issues/scan', { lotNo: scannedLot.lotNo });
      const issueData = res.data?.data ?? res.data;

      // 이력 추가 (최신순)
      setScanHistory((prev) => [
        {
          lotNo: scannedLot.lotNo,
          partCode: scannedLot.partCode,
          partName: scannedLot.partName,
          issueQty: issueData?.issueQty ?? scannedLot.remainQty ?? scannedLot.qty,
          unit: scannedLot.unit ?? 'EA',
          issuedAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      // 초기화 (다음 스캔 준비)
      setScannedLot(null);
      setScanInput('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || '출고 처리에 실패했습니다.');
    }
  }, [scannedLot]);

  // 스캔 결과 취소
  const handleCancel = useCallback(() => {
    setScannedLot(null);
    setScanInput('');
    setError(null);
  }, []);

  return {
    scanInput,
    setScanInput,
    scannedLot,
    scanHistory,
    isScanning,
    error,
    handleScan,
    handleIssue,
    handleCancel,
  };
}
