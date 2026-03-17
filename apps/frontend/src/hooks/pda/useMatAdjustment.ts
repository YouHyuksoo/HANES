/**
 * @file src/hooks/pda/useMatAdjustment.ts
 * @description 재고조정 스캔 플로우 훅 - LOT 스캔 → 현재 수량 조회 → 승인 요청 처리
 *
 * 초보자 가이드:
 * 1. handleScan(matUid): 자재UID 바코드 스캔 → 현재 재고 수량 조회
 * 2. handleAdjust(adjustQty): 수량 조정 → PENDING 상태로 승인 요청 등록
 * 3. handleReset(): 스캔 데이터 초기화 (다음 스캔 준비)
 * 4. reasonCode / reasonText: ComCode 기반 사유 코드 + ETC 직접입력 텍스트
 * 5. 승인 요청 후 관리자가 승인/반려 처리 → 재고 실반영
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** 조정 상태 */
export type AdjustStatus = "PENDING" | "APPROVED" | "REJECTED";

/** LOT 재고 정보 (조정용) */
export interface MatLotAdjustData {
  matUid: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  warehouse: string;
}

/** 조정 이력 항목 */
export interface AdjustmentHistoryItem {
  matUid: string;
  itemCode: string;
  adjustQty: number;
  reasonCode: string;
  reasonText?: string;
  timestamp: string;
  /** 승인 상태 (PENDING/APPROVED/REJECTED) */
  adjustStatus: AdjustStatus;
}

interface UseMatAdjustmentReturn {
  scannedLot: MatLotAdjustData | null;
  isScanning: boolean;
  isAdjusting: boolean;
  error: string | null;
  history: AdjustmentHistoryItem[];
  /** 현재 선택된 사유 코드 (ComCode) */
  reasonCode: string;
  /** ETC 선택 시 직접입력 텍스트 */
  reasonText: string;
  /** 사유 코드 + 텍스트 동시 설정 */
  setReason: (code: string, text?: string) => void;
  handleScan: (matUid: string) => Promise<void>;
  handleAdjust: (adjustQty: number) => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 재고조정 훅 (승인 워크플로우)
 *
 * 플로우:
 * 1. LOT 바코드 스캔 → handleScan → 재고 조회
 * 2. 조정 수량 + 사유 코드 선택 → handleAdjust → PENDING 상태로 서버 등록
 * 3. 관리자가 PC에서 승인/반려 처리 → 재고 실반영
 * 4. handleReset → 다음 스캔 준비
 */
export function useMatAdjustment(): UseMatAdjustmentReturn {
  const [scannedLot, setScannedLot] = useState<MatLotAdjustData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AdjustmentHistoryItem[]>([]);

  /** 사유 코드 (ComCode: ADJ_REASON) */
  const [reasonCode, setReasonCode] = useState<string>("");
  /** ETC 직접입력 텍스트 */
  const [reasonText, setReasonText] = useState<string>("");

  /** 사유 코드 + 텍스트 동시 설정 */
  const setReason = useCallback((code: string, text?: string) => {
    setReasonCode(code);
    setReasonText(text ?? "");
  }, []);

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

  /**
   * 재고 조정 승인 요청 처리
   * POST /api/v1/material/adjustment/pending → status='PENDING' 으로 등록
   */
  const handleAdjust = useCallback(
    async (adjustQty: number): Promise<boolean> => {
      if (!scannedLot) return false;
      setIsAdjusting(true);
      setError(null);
      try {
        await api.post("/material/adjustment/pending", {
          matUid: scannedLot.matUid,
          adjustQty,
          reasonCode,
          reasonText: reasonText || undefined,
        });
        setHistory((prev) => [
          {
            matUid: scannedLot.matUid,
            itemCode: scannedLot.itemCode,
            adjustQty,
            reasonCode,
            reasonText: reasonText || undefined,
            timestamp: new Date().toLocaleTimeString(),
            adjustStatus: "PENDING",
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
    [scannedLot, reasonCode, reasonText],
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
    reasonCode,
    reasonText,
    setReason,
    handleScan,
    handleAdjust,
    handleReset,
  };
}
