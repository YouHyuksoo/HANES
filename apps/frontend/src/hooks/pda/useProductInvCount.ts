/**
 * @file src/hooks/pda/useProductInvCount.ts
 * @description 제품 재고실사 훅 - 옵션(기준월/창고/실사구분) + 바코드 스캔 → 실사 확인
 *
 * 초보자 가이드:
 * 1. handleScan(barcode): 바코드 스캔 → 시스템 재고 조회 (ScannedProduct | null 반환)
 * 2. handleCount(actualQty): 실사 결과 전송 → 성공 시 자동 리셋 (다음 스캔 순환)
 * 3. handleReset(): 수동 리셋 (건너뛰기)
 * 4. options: { countMonth, warehouseCode, countType } 으로 실사 조건 설정
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type { CountType } from "@/components/pda/ProductInvCountOptions";

/** 서버에서 받아오는 제품 재고 정보 */
export interface ScannedProduct {
  id: string;
  barcode: string;
  itemCode: string;
  itemName: string;
  systemQty: number;
  warehouseName: string;
}

/** 실사 이력 항목 */
export interface ProductCountHistoryItem {
  barcode: string;
  itemCode: string;
  itemName: string;
  systemQty: number;
  actualQty: number;
  difference: number;
  countType: CountType;
  timestamp: string;
}

interface UseProductInvCountOptions {
  countMonth?: string;
  warehouseCode?: string;
  countType?: CountType;
}

interface UseProductInvCountReturn {
  scannedProduct: ScannedProduct | null;
  isScanning: boolean;
  isCounting: boolean;
  error: string | null;
  history: ProductCountHistoryItem[];
  handleScan: (barcode: string) => Promise<ScannedProduct | null>;
  handleCount: (actualQty: number) => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 제품 재고실사 훅
 *
 * 플로우:
 * 1. 옵션 설정 (countMonth, warehouseCode, countType)
 * 2. handleScan → 서버에서 시스템 수량 조회 (ScannedProduct 반환)
 * 3. handleCount → 서버에 전송 (countMonth, countType 포함) → 성공 시 자동 리셋
 * 4. handleReset → 수동 리셋 (건너뛰기)
 */
export function useProductInvCount(
  options?: UseProductInvCountOptions,
): UseProductInvCountReturn {
  const { countMonth, warehouseCode, countType = "NORMAL" } = options || {};

  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCounting, setIsCounting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ProductCountHistoryItem[]>([]);

  /** 제품 바코드 스캔 → 시스템 재고 조회 */
  const handleScan = useCallback(
    async (barcode: string): Promise<ScannedProduct | null> => {
      setIsScanning(true);
      setError(null);
      setScannedProduct(null);
      try {
        const params = warehouseCode ? `?warehouseCode=${warehouseCode}` : "";
        const { data } = await api.get<ScannedProduct>(
          `/inventory/products/by-barcode/${encodeURIComponent(barcode)}${params}`,
        );
        setScannedProduct(data);
        return data;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "SCAN_FAILED";
        setError(message);
        return null;
      } finally {
        setIsScanning(false);
      }
    },
    [warehouseCode],
  );

  /** 실사 수량 확인 처리 → 성공 시 자동 리셋 */
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
          countMonth: countMonth || undefined,
          countType,
        });
        const difference = actualQty - scannedProduct.systemQty;
        setHistory((prev) => [
          {
            barcode: scannedProduct.barcode,
            itemCode: scannedProduct.itemCode,
            itemName: scannedProduct.itemName,
            systemQty: scannedProduct.systemQty,
            actualQty,
            difference,
            countType,
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
    [scannedProduct, countMonth, countType],
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
