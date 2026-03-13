/**
 * @file src/hooks/pda/useProductInvCount.ts
 * @description 제품 재고실사 훅 - PC 개시 연동 버전
 *
 * 초보자 가이드:
 * 1. 마운트 시 GET /api/v1/inventory/products/physical-inv/active → 진행 중 실사 세션 조회
 * 2. 세션 없으면 noActiveInv = true (PC에서 실사 개시 필요)
 * 3. handleScanProduct(barcode): 제품 바코드 스캔 → POST /count → 해당 아이템 +1
 * 4. countItems: 품목별 시스템수량 vs 실사수량 배열
 * 5. history: 스캔 이력 (최신순)
 */
import { useState, useCallback, useEffect } from "react";
import { api } from "@/services/api";

/** 실사 세션 정보 */
export interface ProductPhysicalInvSession {
  sessionId: number;
  sessionNo: string;
  warehouseName: string;
  countMonth: string;
  status: string;
}

/** 품목별 실사 현황 */
export interface ProductCountItem {
  itemCode: string;
  itemName: string;
  systemQty: number;
  countedQty: number;
}

/** 스캔 이력 항목 */
export interface ProductCountHistoryItem {
  barcode: string;
  itemCode: string;
  itemName: string;
  countedQty: number;
  timestamp: string;
}

interface UseProductInvCountReturn {
  /** 진행 중 실사 세션 */
  session: ProductPhysicalInvSession | null;
  /** 세션 없음 플래그 */
  noActiveInv: boolean;
  /** 세션 로딩 중 */
  isLoadingSession: boolean;
  /** 품목별 실사 현황 */
  countItems: ProductCountItem[];
  /** 스캔 처리 중 */
  isScanning: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 스캔 이력 */
  history: ProductCountHistoryItem[];
  /** 제품 바코드 스캔 핸들러 */
  handleScanProduct: (barcode: string) => Promise<boolean>;
  /** 에러 초기화 */
  clearError: () => void;
}

/**
 * 제품 재고실사 훅 (PC 개시 연동)
 *
 * 플로우:
 * 1. 마운트 → GET /inventory/products/physical-inv/active → 세션 로드
 * 2. 제품 바코드 연속 스캔 → handleScanProduct → POST count → countItems 갱신 + 이력 추가
 */
export function useProductInvCount(): UseProductInvCountReturn {
  const [session, setSession] = useState<ProductPhysicalInvSession | null>(null);
  const [noActiveInv, setNoActiveInv] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [countItems, setCountItems] = useState<ProductCountItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ProductCountHistoryItem[]>([]);

  /** 마운트 시 활성 제품 실사 세션 조회 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<ProductPhysicalInvSession>(
          "/inventory/products/physical-inv/active",
        );
        if (!cancelled) {
          setSession(data);
          setNoActiveInv(false);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setNoActiveInv(true);
        }
      } finally {
        if (!cancelled) setIsLoadingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** 제품 바코드 스캔 → 실사 수량 +1 처리 */
  const handleScanProduct = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!session) return false;
      setIsScanning(true);
      setError(null);
      try {
        const { data } = await api.post<{
          itemCode: string;
          itemName: string;
          countedQty: number;
          items: ProductCountItem[];
        }>("/inventory/products/physical-inv/count", {
          sessionId: session.sessionId,
          barcode,
        });
        // 서버 응답에서 갱신된 품목 목록 반영
        if (data.items) {
          setCountItems(data.items);
        } else {
          // 서버가 items 반환 안 하면 로컬에서 낙관적 업데이트
          setCountItems((prev) => {
            const exists = prev.some((item) => item.itemCode === data.itemCode);
            if (exists) {
              return prev.map((item) =>
                item.itemCode === data.itemCode
                  ? { ...item, countedQty: data.countedQty }
                  : item,
              );
            }
            return [
              ...prev,
              {
                itemCode: data.itemCode,
                itemName: data.itemName,
                systemQty: 0,
                countedQty: data.countedQty,
              },
            ];
          });
        }
        setHistory((prev) => [
          {
            barcode,
            itemCode: data.itemCode,
            itemName: data.itemName,
            countedQty: data.countedQty,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "SCAN_FAILED";
        setError(message);
        return false;
      } finally {
        setIsScanning(false);
      }
    },
    [session],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    session,
    noActiveInv,
    isLoadingSession,
    countItems,
    isScanning,
    error,
    history,
    handleScanProduct,
    clearError,
  };
}
