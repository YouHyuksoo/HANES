/**
 * @file src/hooks/pda/useProductInvCount.ts
 * @description 제품 재고실사 훅 - 제품 바코드 스캔 → 시스템 수량 조회 → 실사 수량 입력/확인
 *
 * 초보자 가이드:
 * 1. handleScan(barcode): 제품 바코드 스캔 → 서버에서 시스템 재고 정보 조회
 * 2. handleCount(actualQty): 실사 수량 입력 → 서버에 실사 결과 전송
 * 3. handleReset(): 스캔 데이터 초기화 (다음 스캔 준비)
 * 4. history: 실사 완료 이력 (최신순), 차이 값 포함
 * 5. difference = actualQty - systemQty (양수=과잉, 음수=부족, 0=일치)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** 서버에서 받아오는 제품 재고 정보 */
export interface ScannedProduct {
  id: string;
  barcode: string;
  partCode: string;
  partName: string;
  systemQty: number;
  warehouseName: string;
}

/** 실사 이력 항목 */
export interface ProductCountHistoryItem {
  barcode: string;
  partCode: string;
  partName: string;
  systemQty: number;
  actualQty: number;
  difference: number;
  timestamp: string;
}

interface UseProductInvCountReturn {
  scannedProduct: ScannedProduct | null;
  isScanning: boolean;
  isCounting: boolean;
  error: string | null;
  history: ProductCountHistoryItem[];
  handleScan: (barcode: string) => Promise<void>;
  handleCount: (actualQty: number) => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 제품 재고실사 훅
 *
 * 플로우:
 * 1. 제품 바코드 스캔 → handleScan → 서버에서 시스템 수량 조회
 * 2. 실사 수량 입력 → handleCount → 서버에 전송 (차이 자동 계산)
 * 3. handleReset → 다음 스캔 준비
 */
export function useProductInvCount(): UseProductInvCountReturn {
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(
    null,
  );
  const [isScanning, setIsScanning] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ProductCountHistoryItem[]>([]);

  /** 제품 바코드 스캔 → 시스템 재고 조회 */
  const handleScan = useCallback(async (barcode: string) => {
    setIsScanning(true);
    setError(null);
    setScannedProduct(null);
    try {
      const { data } = await api.get<ScannedProduct>(
        `/inventory/products/by-barcode/${encodeURIComponent(barcode)}`,
      );
      setScannedProduct(data);
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
      if (!scannedProduct) return false;
      setIsCounting(true);
      setError(null);
      try {
        await api.post("/inventory/products/count", {
          barcode: scannedProduct.barcode,
          productId: scannedProduct.id,
          systemQty: scannedProduct.systemQty,
          actualQty,
        });
        const difference = actualQty - scannedProduct.systemQty;
        setHistory((prev) => [
          {
            barcode: scannedProduct.barcode,
            partCode: scannedProduct.partCode,
            partName: scannedProduct.partName,
            systemQty: scannedProduct.systemQty,
            actualQty,
            difference,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setScannedProduct(null);
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
    [scannedProduct],
  );

  /** 스캔 데이터 초기화 */
  const handleReset = useCallback(() => {
    setScannedProduct(null);
    setError(null);
  }, []);

  return {
    scannedProduct,
    isScanning,
    isCounting,
    error,
    history,
    handleScan,
    handleCount,
    handleReset,
  };
}
