/**
 * @file src/hooks/pda/useMatInventoryCount.ts
 * @description 자재 재고실사 훅 - LOT 스캔 → 시스템 수량 조회 → 실사 수량 입력/확인
 *
 * 초보자 가이드:
 * 1. handleScan(lotNo): LOT 바코드 스캔 → 시스템 재고 수량 조회
 * 2. handleCount(actualQty): 실사 수량 입력 → 서버에 실사 결과 전송
 * 3. history: 실사 완료 이력 (최신순), 차이 값 포함
 * 4. difference = actualQty - systemQty (양수=초과, 음수=부족)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** LOT 재고 정보 (실사용) */
export interface MatLotCountData {
  lotNo: string;
  itemCode: string;
  itemName: string;
  systemQty: number;
  unit: string;
  warehouse: string;
}

/** 실사 이력 항목 */
export interface CountHistoryItem {
  lotNo: string;
  itemCode: string;
  itemName: string;
  systemQty: number;
  actualQty: number;
  difference: number;
  timestamp: string;
}

interface UseMatInventoryCountReturn {
  scannedLot: MatLotCountData | null;
  isScanning: boolean;
  isCounting: boolean;
  error: string | null;
  history: CountHistoryItem[];
  handleScan: (lotNo: string) => Promise<void>;
  handleCount: (actualQty: number) => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 자재 재고실사 훅
 *
 * 플로우:
 * 1. LOT 바코드 스캔 → handleScan → 시스템 수량 조회
 * 2. 실사 수량 입력 → handleCount → 서버에 전송 (차이 자동 계산)
 * 3. handleReset → 다음 스캔 준비
 */
export function useMatInventoryCount(): UseMatInventoryCountReturn {
  const [scannedLot, setScannedLot] = useState<MatLotCountData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CountHistoryItem[]>([]);

  /** LOT 바코드 스캔 → 시스템 수량 조회 */
  const handleScan = useCallback(async (lotNo: string) => {
    setIsScanning(true);
    setError(null);
    setScannedLot(null);
    try {
      const { data } = await api.get<MatLotCountData>(
        `/material/lots/by-lotno/${encodeURIComponent(lotNo)}`,
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

  /** 실사 수량 확인 처리 */
  const handleCount = useCallback(
    async (actualQty: number): Promise<boolean> => {
      if (!scannedLot) return false;
      setIsCounting(true);
      setError(null);
      try {
        await api.post("/material/inventory-count", {
          lotNo: scannedLot.lotNo,
          systemQty: scannedLot.systemQty,
          actualQty,
        });
        const difference = actualQty - scannedLot.systemQty;
        setHistory((prev) => [
          {
            lotNo: scannedLot.lotNo,
            itemCode: scannedLot.itemCode,
            itemName: scannedLot.itemName,
            systemQty: scannedLot.systemQty,
            actualQty,
            difference,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setScannedLot(null);
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "COUNT_FAILED";
        setError(message);
        return false;
      } finally {
        setIsCounting(false);
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
    isCounting,
    error,
    history,
    handleScan,
    handleCount,
    handleReset,
  };
}
