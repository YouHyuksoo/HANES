/**
 * @file src/hooks/pda/useMatAdjustment.ts
 * @description 재고조정 스캔 플로우 훅 - LOT 스캔 → 현재 수량 조회 → 조정 처리
 *
 * 초보자 가이드:
 * 1. handleScan(matUid): 자재UID 바코드 스캔 → 현재 재고 수량 조회
 * 2. handleAdjust(adjustQty, reason): 수량 조정 + 사유 기록
 * 3. handleReset(): 스캔 데이터 초기화 (다음 스캔 준비)
 * 4. 재고조정은 +/- 값 모두 가능 (양수=증가, 음수=감소)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** LOT 재고 정보 (조정용) */
export interface MatLotAdjustData {
  matUid: string;
  itemCode: string;
  itemName: string;
  currentQty: number;
  unit: string;
  warehouse: string;
}

/** 조정 이력 항목 */
export interface AdjustmentHistoryItem {
  matUid: string;
  itemCode: string;
  adjustQty: number;
  reason: string;
  timestamp: string;
}

interface UseMatAdjustmentReturn {
  scannedLot: MatLotAdjustData | null;
  isScanning: boolean;
  isAdjusting: boolean;
  error: string | null;
  history: AdjustmentHistoryItem[];
  handleScan: (matUid: string) => Promise<void>;
  handleAdjust: (adjustQty: number, reason: string) => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 재고조정 훅
 *
 * 플로우:
 * 1. LOT 바코드 스캔 → handleScan → 재고 조회
 * 2. 조정 수량 + 사유 입력 → handleAdjust → 서버 처리
 * 3. handleReset → 다음 스캔 준비
 */
export function useMatAdjustment(): UseMatAdjustmentReturn {
  const [scannedLot, setScannedLot] = useState<MatLotAdjustData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AdjustmentHistoryItem[]>([]);

  /** 자재UID 바코드 스캔 → 재고 조회 */
  const handleScan = useCallback(async (matUid: string) => {
    setIsScanning(true);
    setError(null);
    setScannedLot(null);
    try {
      const { data } = await api.get<MatLotAdjustData>(
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

  /** 재고 조정 처리 */
  const handleAdjust = useCallback(
    async (adjustQty: number, reason: string): Promise<boolean> => {
      if (!scannedLot) return false;
      setIsAdjusting(true);
      setError(null);
      try {
        await api.post("/material/adjustment", {
          matUid: scannedLot.matUid,
          adjustQty,
          reason,
        });
        setHistory((prev) => [
          {
            matUid: scannedLot.matUid,
            itemCode: scannedLot.itemCode,
            adjustQty,
            reason,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setScannedLot(null);
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "ADJUST_FAILED";
        setError(message);
        return false;
      } finally {
        setIsAdjusting(false);
      }
    },
    [scannedLot],
  );

  /** 스캔 데이터 초기화 */
  const handleReset = useCallback(() => {
    setScannedLot(null);
    setError(null);
  }, []);

  return {
    scannedLot,
    isScanning,
    isAdjusting,
    error,
    history,
    handleScan,
    handleAdjust,
    handleReset,
  };
}
