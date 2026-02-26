/**
 * @file src/hooks/pda/useMatReceivingScan.ts
 * @description 자재입고 스캔 플로우 훅 - 바코드 스캔 → 입고 데이터 조회 → 입고 확인
 *
 * 초보자 가이드:
 * 1. handleScan(barcode): 바코드 스캔 시 서버에서 입고 대상 데이터 조회
 * 2. handleConfirm(receivedQty, warehouseCode): 입고 확인 처리 (LOT번호 자동 생성)
 * 3. handleReset(): 스캔 데이터 초기화 (다음 스캔 준비)
 * 4. history: 입고 완료 이력 (최신순 정렬)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** 서버에서 받아오는 입고 대상 데이터 */
export interface MatArrivalData {
  id: number;
  poNo: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  unit: string;
  supplier: string;
}

/** 입고 완료 이력 항목 */
export interface ReceivingHistoryItem {
  matUid: string;
  itemCode: string;
  itemName: string;
  receivedQty: number;
  warehouseCode: string;
  timestamp: string;
}

interface UseMatReceivingScanReturn {
  scannedData: MatArrivalData | null;
  isScanning: boolean;
  isConfirming: boolean;
  error: string | null;
  history: ReceivingHistoryItem[];
  handleScan: (barcode: string) => Promise<void>;
  handleConfirm: (receivedQty: number, warehouseCode: string) => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 자재입고 스캔 훅
 *
 * 플로우:
 * 1. 바코드 스캔 → handleScan → 서버 조회 → scannedData 세팅
 * 2. 수량 입력 → handleConfirm → 입고 처리 → history에 추가
 * 3. handleReset → 다음 스캔 준비
 */
export function useMatReceivingScan(): UseMatReceivingScanReturn {
  const [scannedData, setScannedData] = useState<MatArrivalData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReceivingHistoryItem[]>([]);

  /** 바코드 스캔 → 입고 대상 조회 */
  const handleScan = useCallback(async (barcode: string) => {
    setIsScanning(true);
    setError(null);
    setScannedData(null);
    try {
      const { data } = await api.get<MatArrivalData>(
        `/material/arrival/by-barcode/${encodeURIComponent(barcode)}`,
      );
      setScannedData(data);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "SCAN_FAILED";
      setError(message);
    } finally {
      setIsScanning(false);
    }
  }, []);

  /** 입고 확인 처리 */
  const handleConfirm = useCallback(
    async (receivedQty: number, warehouseCode: string): Promise<boolean> => {
      if (!scannedData) return false;
      setIsConfirming(true);
      setError(null);
      try {
        await api.post("/material/receiving", {
          arrivalId: scannedData.id,
          receivedQty,
          warehouseCode,
          matUid: `MAT-${Date.now()}`,
        });
        // 이력 추가 (최신 항목이 상단)
        setHistory((prev) => [
          {
            matUid: `MAT-${Date.now()}`,
            itemCode: scannedData.itemCode,
            itemName: scannedData.itemName,
            receivedQty,
            warehouseCode,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setScannedData(null);
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "CONFIRM_FAILED";
        setError(message);
        return false;
      } finally {
        setIsConfirming(false);
      }
    },
    [scannedData],
  );

  /** 스캔 데이터 초기화 */
  const handleReset = useCallback(() => {
    setScannedData(null);
    setError(null);
  }, []);

  return {
    scannedData,
    isScanning,
    isConfirming,
    error,
    history,
    handleScan,
    handleConfirm,
    handleReset,
  };
}
