/**
 * @file src/hooks/pda/useMatReceivingScan.ts
 * @description 자재입고 스캔 플로우 훅 - 바코드 스캔 → IQC 상태 확인 → 입고 데이터 조회 → 입고 확인
 *
 * 초보자 가이드:
 * 1. handleScan(barcode): 바코드 스캔 시 서버에서 입고 대상 데이터 조회 + IQC 상태 검증
 *    - IQC FAIL → playError + 에러 메시지 반환 (입고 불가)
 *    - IQC IN_PROGRESS → 에러 메시지 반환 (입고 불가)
 *    - IQC NONE(무검사) or PASS → 정상 진행
 * 2. handleConfirm(receivedQty, warehouseCode, locationCode): 입고 확인 처리 (matUid는 서버에서 생성)
 * 3. handleReset(): 스캔 데이터 초기화 (다음 스캔 준비)
 * 4. history: 입고 완료 이력 (최신순 정렬)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** IQC 검사 상태 */
export type IqcStatus = "PASS" | "FAIL" | "IN_PROGRESS" | "NONE";

/** 서버에서 받아오는 입고 대상 데이터 */
export interface MatArrivalData {
  arrivalNo: string;
  poNo: string;
  itemCode: string;
  itemName: string;
  orderQty: number;
  unit: string;
  supplier: string;
  iqcStatus: IqcStatus;
}

/** 입고 완료 이력 항목 */
export interface ReceivingHistoryItem {
  matUid: string;
  itemCode: string;
  itemName: string;
  receivedQty: number;
  warehouseCode: string;
  locationCode: string;
  timestamp: string;
}

/** handleScan 결과 타입 */
export type ScanResult = "ok" | "iqc_fail" | "iqc_in_progress" | "error";

interface UseMatReceivingScanReturn {
  scannedData: MatArrivalData | null;
  isScanning: boolean;
  isConfirming: boolean;
  error: string | null;
  history: ReceivingHistoryItem[];
  locationCode: string;
  setLocationCode: (code: string) => void;
  handleScan: (barcode: string) => Promise<ScanResult>;
  handleConfirm: (
    receivedQty: number,
    warehouseCode: string,
    locationCode: string,
  ) => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 자재입고 스캔 훅
 *
 * 플로우:
 * 1. 바코드 스캔 → handleScan → IQC 상태 확인 → scannedData 세팅
 * 2. 창고/로케이션 선택 + 수량 입력 → handleConfirm → 입고 처리 → history에 추가
 * 3. handleReset → 다음 스캔 준비
 */
export function useMatReceivingScan(): UseMatReceivingScanReturn {
  const [scannedData, setScannedData] = useState<MatArrivalData | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ReceivingHistoryItem[]>([]);
  const [locationCode, setLocationCode] = useState<string>("");

  /**
   * 바코드 스캔 → IQC 상태 확인 → 입고 대상 조회
   *
   * IQC 상태별 처리:
   * - FAIL: "IQC_FAIL" 에러 키 → 페이지에서 t()로 표시
   * - IN_PROGRESS: "IQC_IN_PROGRESS" 에러 키 → 페이지에서 t()로 표시
   * - NONE / PASS: 정상 진행
   */
  const handleScan = useCallback(async (barcode: string): Promise<ScanResult> => {
    setIsScanning(true);
    setError(null);
    setScannedData(null);
    try {
      const { data } = await api.get<MatArrivalData>(
        `/material/arrivals/by-barcode/${encodeURIComponent(barcode)}`,
      );

      // IQC 상태 분기
      if (data.iqcStatus === "FAIL") {
        setError("IQC_FAIL");
        return "iqc_fail";
      }
      if (data.iqcStatus === "IN_PROGRESS") {
        setError("IQC_IN_PROGRESS");
        return "iqc_in_progress";
      }

      // PASS 또는 NONE(무검사) → 정상 진행
      setScannedData(data);
      return "ok";
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "SCAN_FAILED";
      setError(message);
      return "error";
    } finally {
      setIsScanning(false);
    }
  }, []);

  /**
   * 입고 확인 처리
   * - matUid는 서버에서 생성 (클라이언트에서 생성 금지)
   * - locationCode를 추가로 전송
   */
  const handleConfirm = useCallback(
    async (
      receivedQty: number,
      warehouseCode: string,
      locCode: string,
    ): Promise<boolean> => {
      if (!scannedData) return false;
      setIsConfirming(true);
      setError(null);
      try {
        const { data: result } = await api.post<{ matUid: string }>(
          "/material/receiving",
          {
            arrivalId: scannedData.arrivalNo,
            receivedQty,
            warehouseCode,
            locationCode: locCode,
          },
        );
        // 이력 추가 (최신 항목이 상단)
        setHistory((prev) => [
          {
            matUid: result?.matUid ?? "",
            itemCode: scannedData.itemCode,
            itemName: scannedData.itemName,
            receivedQty,
            warehouseCode,
            locationCode: locCode,
            timestamp: new Date().toLocaleTimeString(),
          },
          ...prev,
        ]);
        setScannedData(null);
        setLocationCode("");
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
    setLocationCode("");
  }, []);

  return {
    scannedData,
    isScanning,
    isConfirming,
    error,
    history,
    locationCode,
    setLocationCode,
    handleScan,
    handleConfirm,
    handleReset,
  };
}
