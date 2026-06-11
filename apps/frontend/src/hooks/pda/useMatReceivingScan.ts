/**
 * @file src/hooks/pda/useMatReceivingScan.ts
 * @description 자재입고 스캔 플로우 훅 (웹/PDA 통일)
 *
 * 워크플로우 통일(2026-06-10):
 * - 웹(/material/receive)과 동일하게 **시리얼(matUid) 바코드**를 스캔한다.
 * - 입하 시 시리얼이 생성되므로 PDA도 기존 시리얼을 스캔해 입고한다.
 * - 입고 확정은 공통 계약 POST /material/receiving { items: [{ matUid, qty, warehouseId }] } 사용.
 *
 * 1. handleScan(matUid): GET /material/receiving/receivable/by-barcode/:matUid 로 입고가능 LOT 조회
 *    (IQC 합격 또는 특채 승인 + 미입고 잔량 보유 LOT만 반환, 그 외는 에러)
 * 2. handleConfirm(qty, warehouseCode): 공통 입고 API로 확정
 * 3. handleReset(): 스캔 데이터 초기화
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** IQC 검사 상태 */
export type IqcStatus = "PASS" | "FAIL" | "IN_PROGRESS" | "NONE";

/** 서버에서 받아오는 입고가능 LOT 데이터 (findReceivable 가공 결과) */
export interface MatReceivableLot {
  matUid: string;
  itemCode: string;
  poNo?: string | null;
  vendor?: string | null;
  iqcStatus: string;
  remainingQty: number;
  isConcession?: boolean;
  part?: { itemCode: string; itemName: string; unit: string } | null;
}

/** 입고 완료 이력 항목 */
export interface ReceivingHistoryItem {
  matUid: string;
  itemCode: string;
  itemName: string;
  receivedQty: number;
  warehouseCode: string;
  workerName?: string;
  timestamp: string;
}

/** handleScan 결과 타입 */
export type ScanResult = "ok" | "error";

interface UseMatReceivingScanReturn {
  scannedData: MatReceivableLot | null;
  isScanning: boolean;
  isConfirming: boolean;
  error: string | null;
  history: ReceivingHistoryItem[];
  handleScan: (barcode: string) => Promise<ScanResult>;
  handleConfirm: (
    receivedQty: number,
    warehouseCode: string,
    workerId?: string,
    workerName?: string,
  ) => Promise<boolean>;
  handleReset: () => void;
}

export function useMatReceivingScan(): UseMatReceivingScanReturn {
  const [scannedData, setScannedData] = useState<MatReceivableLot | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReceivingHistoryItem[]>([]);

  const extractMsg = (err: unknown, fallback: string): string =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

  /** 시리얼(matUid) 바코드 스캔 → 입고가능 LOT 조회 */
  const handleScan = useCallback(async (barcode: string): Promise<ScanResult> => {
    const matUid = barcode.trim();
    if (!matUid) return "error";
    setIsScanning(true);
    setError(null);
    setScannedData(null);
    try {
      const { data } = await api.get<{ data: MatReceivableLot }>(
        `/material/receiving/receivable/by-barcode/${encodeURIComponent(matUid)}`,
        { suppressErrorModal: true },
      );
      const lot = data?.data ?? (data as unknown as MatReceivableLot);
      setScannedData(lot);
      return "ok";
    } catch (err: unknown) {
      setError(extractMsg(err, "SCAN_FAILED"));
      return "error";
    } finally {
      setIsScanning(false);
    }
  }, []);

  /** 입고 확정 (공통 계약: items[]) */
  const handleConfirm = useCallback(
    async (
      receivedQty: number,
      warehouseCode: string,
      workerId?: string,
      workerName?: string,
    ): Promise<boolean> => {
      if (!scannedData) return false;
      setIsConfirming(true);
      setError(null);
      try {
        await api.post(
          "/material/receiving",
          {
            items: [
              { matUid: scannedData.matUid, qty: receivedQty, warehouseId: warehouseCode },
            ],
            workerId: workerId || undefined,
          },
          { suppressErrorModal: true },
        );
        setHistory((prev) => [
          {
            matUid: scannedData.matUid,
            itemCode: scannedData.itemCode,
            itemName: scannedData.part?.itemName ?? scannedData.itemCode,
            receivedQty,
            warehouseCode,
            workerName: workerName || undefined,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setScannedData(null);
        return true;
      } catch (err: unknown) {
        setError(extractMsg(err, "CONFIRM_FAILED"));
        return false;
      } finally {
        setIsConfirming(false);
      }
    },
    [scannedData],
  );

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
