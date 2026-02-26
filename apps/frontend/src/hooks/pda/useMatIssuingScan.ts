/**
 * @file src/hooks/pda/useMatIssuingScan.ts
 * @description 자재출고 스캔 플로우 훅 - LOT 바코드 스캔 → 재고 조회 → 출고 처리
 *
 * 초보자 가이드:
 * 1. handleScan(matUid): 자재UID 바코드 스캔 → 해당 LOT의 재고 정보 조회
 * 2. handleIssue(): 스캔한 LOT 전량 출고 처리
 * 3. history: 출고 완료 이력 (최신순 정렬)
 * 4. handleReset(): 스캔 데이터 초기화 (다음 스캔 준비)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** LOT 재고 정보 */
export interface MatLotData {
  matUid: string;
  itemCode: string;
  itemName: string;
  remainQty: number;
  unit: string;
  warehouse: string;
}

/** 출고 이력 항목 */
export interface IssuingHistoryItem {
  matUid: string;
  itemCode: string;
  itemName: string;
  issuedQty: number;
  timestamp: string;
}

interface UseMatIssuingScanReturn {
  scannedLot: MatLotData | null;
  isScanning: boolean;
  isIssuing: boolean;
  error: string | null;
  history: IssuingHistoryItem[];
  handleScan: (matUid: string) => Promise<void>;
  handleIssue: () => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 자재출고 스캔 훅
 *
 * 플로우:
 * 1. LOT 바코드 스캔 → handleScan → 재고 조회 → scannedLot 세팅
 * 2. 출고 버튼 → handleIssue → 전량 출고 → history에 추가
 * 3. handleReset → 다음 스캔 준비
 */
export function useMatIssuingScan(): UseMatIssuingScanReturn {
  const [scannedLot, setScannedLot] = useState<MatLotData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isIssuing, setIsIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<IssuingHistoryItem[]>([]);

  /** 자재UID 바코드 스캔 → 재고 조회 */
  const handleScan = useCallback(async (matUid: string) => {
    setIsScanning(true);
    setError(null);
    setScannedLot(null);
    try {
      const { data } = await api.get<MatLotData>(
        `/material/lots/by-uid/${encodeURIComponent(matUid)}`,
      );
      setScannedLot(data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "SCAN_FAILED";
      setError(message);
    } finally {
      setIsScanning(false);
    }
  }, []);

  /** 전량 출고 처리 */
  const handleIssue = useCallback(async (): Promise<boolean> => {
    if (!scannedLot) return false;
    setIsIssuing(true);
    setError(null);
    try {
      await api.post("/material/issues/scan", {
        matUid: scannedLot.matUid,
      });
      setHistory((prev) => [
        {
          matUid: scannedLot.matUid,
          itemCode: scannedLot.itemCode,
          itemName: scannedLot.itemName,
          issuedQty: scannedLot.remainQty,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      setScannedLot(null);
      return true;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "ISSUE_FAILED";
      setError(message);
      return false;
    } finally {
      setIsIssuing(false);
    }
  }, [scannedLot]);

  /** 스캔 데이터 초기화 */
  const handleReset = useCallback(() => {
    setScannedLot(null);
    setError(null);
  }, []);

  return {
    scannedLot,
    isScanning,
    isIssuing,
    error,
    history,
    handleScan,
    handleIssue,
    handleReset,
  };
}
