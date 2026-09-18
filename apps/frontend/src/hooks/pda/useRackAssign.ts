"use client";

/**
 * @file src/hooks/pda/useRackAssign.ts
 * @description PDA 창고랙 지정 훅 — 랙(로케이션) 스캔 후 자재 시리얼을 연속 스캔해 보관위치를 지정한다.
 *
 * 초보자 가이드:
 * 1. 품목마스터의 고정위치는 입고 시 기본값이고, 이 기능으로 변동 위치를 지정한다.
 * 2. 랙 바코드는 WAREHOUSE_LOCATIONS.LOCATION_CODE 를 그대로 스캔한다.
 * 3. 자재 스캔 시 POST /material/stocks/assign-location 으로 MAT_STOCKS.LOCATION_CODE 를 갱신한다.
 * 4. 랙이 재고의 창고에 등록돼 있지 않으면 서버가 거부하므로 그 메시지를 그대로 보여준다.
 */
import { useCallback, useState } from "react";
import { api } from "@/services/api";

export interface RackAssignHistoryItem {
  matUid: string;
  locationCode: string;
  locationName?: string | null;
  previousLocationCode?: string | null;
  timestamp: string;
}

interface AssignLocationResponse {
  matUid: string;
  warehouseCode: string;
  previousLocationCode?: string | null;
  locationCode: string;
  locationName?: string | null;
  changed: boolean;
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error ? error.message : fallback;
}

export function useRackAssign() {
  const [locationCode, setLocationCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RackAssignHistoryItem[]>([]);

  const clearError = useCallback(() => setError(null), []);

  /** 랙 스캔 — 코드만 보관하고, 유효성은 자재 지정 시 서버가 판정한다. */
  const handleScanLocation = useCallback((code: string) => {
    const trimmed = code.replace(/\r?\n|\r/g, "").trim();
    if (!trimmed) return;
    setLocationCode(trimmed);
    setError(null);
  }, []);

  /** 랙 해제 — 다른 랙으로 옮겨 작업할 때 */
  const resetLocation = useCallback(() => {
    setLocationCode("");
    setError(null);
  }, []);

  /** 자재 시리얼 스캔 → 보관위치 지정 */
  const handleScanMaterial = useCallback(
    async (barcode: string): Promise<boolean> => {
      const matUid = barcode.replace(/\r?\n|\r/g, "").trim();
      if (!matUid || !locationCode) return false;

      setIsScanning(true);
      setError(null);
      try {
        const res = await api.post("/material/stocks/assign-location", {
          matUid,
          locationCode,
        });
        const data = (res.data?.data ?? res.data) as AssignLocationResponse;
        setHistory((prev) => [
          {
            matUid: data.matUid,
            locationCode: data.locationCode,
            locationName: data.locationName,
            previousLocationCode: data.previousLocationCode ?? null,
            timestamp: new Date().toLocaleTimeString("ko-KR", { hour12: false }),
          },
          ...prev,
        ]);
        return true;
      } catch (err: unknown) {
        setError(errorMessage(err, "보관위치 지정에 실패했습니다."));
        return false;
      } finally {
        setIsScanning(false);
      }
    },
    [locationCode],
  );

  return {
    locationCode,
    isScanning,
    error,
    history,
    handleScanLocation,
    handleScanMaterial,
    resetLocation,
    clearError,
  };
}
