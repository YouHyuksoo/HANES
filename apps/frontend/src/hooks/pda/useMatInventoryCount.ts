/**
 * @file src/hooks/pda/useMatInventoryCount.ts
 * @description 자재 재고실사 훅 - PC 개시 연동 버전
 *
 * 초보자 가이드:
 * 1. 마운트 시 GET /api/v1/material/physical-inv/session/active → 진행 중 실사 세션 조회
 * 2. 세션 없으면 noActiveInv = true (PC에서 실사 개시 필요)
 * 3. handleScanLocation(locationCode): 로케이션 코드 스캔 → 해당 로케이션의 품목별 수량 조회
 * 4. handleScanMaterial(barcode): 자재 바코드 스캔 → POST /count → 해당 아이템 +1
 * 5. countItems: 현재 로케이션의 품목별 시스템수량 vs 실사수량 배열
 * 6. history: 스캔 이력 (최신순)
 */
import { useState, useCallback, useEffect } from "react";
import { api } from "@/services/api";

/** 실사 세션 정보 */
export interface PhysicalInvSession {
  sessionDate: string;
  seq: number;
  sessionNo: string;
  warehouseCode: string | null;
  warehouseName: string;
  countMonth: string;
  status: string;
}

/** 로케이션의 품목별 실사 현황 */
export interface CountItem {
  itemCode: string;
  itemName: string;
  unit: string;
  systemQty: number;
  countedQty: number;
}

/** 스캔 이력 항목 */
export interface CountHistoryItem {
  barcode: string;
  itemCode: string;
  itemName: string;
  locationCode: string;
  countedQty: number;
  timestamp: string;
}

interface UseMatInventoryCountReturn {
  /** 진행 중 실사 세션 */
  session: PhysicalInvSession | null;
  /** 세션 없음 플래그 */
  noActiveInv: boolean;
  /** 세션 로딩 중 */
  isLoadingSession: boolean;
  /** 현재 선택된 로케이션 코드 */
  locationCode: string;
  /** 현재 로케이션 품목별 현황 */
  countItems: CountItem[];
  /** 로케이션 수량 조회 중 */
  isLoadingItems: boolean;
  /** 자재 스캔 처리 중 */
  isScanning: boolean;
  /** 에러 메시지 */
  error: string | null;
  /** 스캔 이력 */
  history: CountHistoryItem[];
  /** 로케이션 스캔 핸들러 */
  handleScanLocation: (code: string) => Promise<void>;
  /** 자재 바코드 스캔 핸들러 */
  handleScanMaterial: (barcode: string) => Promise<boolean>;
  /** 에러 초기화 */
  clearError: () => void;
}

/**
 * 자재 재고실사 훅 (PC 개시 연동)
 *
 * 플로우:
 * 1. 마운트 → GET session/active → 세션 로드
 * 2. 로케이션 바코드 스캔 → handleScanLocation → countItems 갱신
 * 3. 자재 바코드 연속 스캔 → handleScanMaterial → POST count → countItems 갱신 + 이력 추가
 */
export function useMatInventoryCount(): UseMatInventoryCountReturn {
  const [session, setSession] = useState<PhysicalInvSession | null>(null);
  const [noActiveInv, setNoActiveInv] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [locationCode, setLocationCode] = useState("");
  const [countItems, setCountItems] = useState<CountItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<CountHistoryItem[]>([]);

  /** 마운트 시 활성 실사 세션 조회 */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get("/material/physical-inv/session/active");
        const sessionData = data?.data ?? data;
        if (!cancelled) {
          if (sessionData) {
            setSession(sessionData);
            setNoActiveInv(false);
          } else {
            setSession(null);
            setNoActiveInv(true);
          }
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

  /** 로케이션 코드 스캔 → 해당 로케이션 품목별 현황 조회 */
  const handleScanLocation = useCallback(
    async (code: string) => {
      if (!session) return;
      setLocationCode(code);
      setCountItems([]);
      setError(null);
      setIsLoadingItems(true);
      try {
        const { data } = await api.get(
          `/material/physical-inv/session/${session.sessionDate}/${session.seq}/location/${encodeURIComponent(code)}`,
        );
        setCountItems(data?.data ?? data ?? []);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "LOCATION_LOAD_FAILED";
        setError(message);
      } finally {
        setIsLoadingItems(false);
      }
    },
    [session],
  );

  /** 자재 바코드 스캔 → 실사 수량 +1 처리 */
  const handleScanMaterial = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!session || !locationCode) return false;
      setIsScanning(true);
      setError(null);
      try {
        const { data } = await api.post<{
          data: { itemCode: string; itemName: string; countedQty: number };
        }>("/material/physical-inv/count", {
          sessionDate: session.sessionDate,
          seq: session.seq,
          locationCode,
          barcode,
        });
        const result = data?.data ?? data;
        // 로컬 카운트 업데이트
        setCountItems((prev) =>
          prev.map((item) =>
            item.itemCode === result.itemCode
              ? { ...item, countedQty: result.countedQty }
              : item,
          ),
        );
        setHistory((prev) => [
          {
            barcode,
            itemCode: result.itemCode,
            itemName: result.itemName,
            locationCode,
            countedQty: result.countedQty,
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
    [session, locationCode],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    session,
    noActiveInv,
    isLoadingSession,
    locationCode,
    countItems,
    isLoadingItems,
    isScanning,
    error,
    history,
    handleScanLocation,
    handleScanMaterial,
    clearError,
  };
}
