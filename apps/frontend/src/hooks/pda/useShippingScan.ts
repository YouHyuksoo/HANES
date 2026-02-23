/**
 * @file src/hooks/pda/useShippingScan.ts
 * @description 출하등록 스캔 플로우 훅 - 출하지시 바코드 스캔 → 제품 바코드 스캔 → 출하 확인
 *
 * 초보자 가이드:
 * 1. handleScan(barcode): 첫 스캔은 출하지시 바코드 → 이후 제품 바코드 추가
 * 2. handleConfirmShip(): 스캔된 제품 바코드 목록으로 출하등록 API 호출
 * 3. handleReset(): 스캔 데이터 전체 초기화 (다음 출하지시 준비)
 * 4. scannedOrder: 출하지시 데이터 (첫 스캔 후 세팅)
 * 5. scannedItems: 제품 바코드 목록 (중복 방지 포함)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** 서버에서 받아오는 출하지시 데이터 */
export interface ShipOrderData {
  id: string;
  shipOrderNo: string;
  customerName: string;
  partCode: string;
  partName: string;
  orderQty: number;
}

/** 스캔된 제품 바코드 항목 */
export interface ScannedShipItem {
  barcode: string;
  scannedAt: string;
}

/** 출하 완료 이력 항목 */
export interface ShipHistoryItem {
  shipOrderNo: string;
  customerName: string;
  partCode: string;
  scannedQty: number;
  timestamp: string;
}

interface UseShippingScanReturn {
  scannedOrder: ShipOrderData | null;
  scannedItems: ScannedShipItem[];
  isScanning: boolean;
  isConfirming: boolean;
  error: string | null;
  history: ShipHistoryItem[];
  handleScan: (barcode: string) => Promise<void>;
  handleConfirmShip: () => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 출하등록 스캔 훅
 *
 * 플로우:
 * 1. 출하지시 바코드 스캔 → handleScan → 서버 조회 → scannedOrder 세팅
 * 2. 제품 바코드 스캔 → handleScan → scannedItems에 추가 (중복 시 에러)
 * 3. handleConfirmShip → 출하 등록 API 호출 → history에 추가
 * 4. handleReset → 다음 출하지시 준비
 */
export function useShippingScan(): UseShippingScanReturn {
  const [scannedOrder, setScannedOrder] = useState<ShipOrderData | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedShipItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ShipHistoryItem[]>([]);

  /** 바코드 스캔 처리 (출하지시 or 제품 바코드) */
  const handleScan = useCallback(
    async (barcode: string) => {
      setError(null);

      // 출하지시가 아직 없으면 → 출하지시 바코드 조회
      if (!scannedOrder) {
        setIsScanning(true);
        try {
          const { data } = await api.get<ShipOrderData>(
            `/shipping/orders/by-barcode/${encodeURIComponent(barcode)}`,
          );
          setScannedOrder(data);
        } catch (err: unknown) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "SCAN_FAILED";
          setError(message);
        } finally {
          setIsScanning(false);
        }
        return;
      }

      // 출하지시가 이미 있으면 → 제품 바코드 추가
      const isDuplicate = scannedItems.some(
        (item) => item.barcode === barcode,
      );
      if (isDuplicate) {
        setError("DUPLICATE_BARCODE");
        return;
      }

      setScannedItems((prev) => [
        { barcode, scannedAt: new Date().toLocaleTimeString() },
        ...prev,
      ]);
    },
    [scannedOrder, scannedItems],
  );

  /** 출하 확인 처리 */
  const handleConfirmShip = useCallback(async (): Promise<boolean> => {
    if (!scannedOrder || scannedItems.length === 0) return false;
    setIsConfirming(true);
    setError(null);
    try {
      await api.post("/shipping/register", {
        shipOrderId: scannedOrder.id,
        items: scannedItems,
      });
      // 이력 추가 (최신 항목이 상단)
      setHistory((prev) => [
        {
          shipOrderNo: scannedOrder.shipOrderNo,
          customerName: scannedOrder.customerName,
          partCode: scannedOrder.partCode,
          scannedQty: scannedItems.length,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      // 상태 초기화
      setScannedOrder(null);
      setScannedItems([]);
      return true;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "CONFIRM_FAILED";
      setError(message);
      return false;
    } finally {
      setIsConfirming(false);
    }
  }, [scannedOrder, scannedItems]);

  /** 전체 초기화 */
  const handleReset = useCallback(() => {
    setScannedOrder(null);
    setScannedItems([]);
    setError(null);
  }, []);

  return {
    scannedOrder,
    scannedItems,
    isScanning,
    isConfirming,
    error,
    history,
    handleScan,
    handleConfirmShip,
    handleReset,
  };
}
