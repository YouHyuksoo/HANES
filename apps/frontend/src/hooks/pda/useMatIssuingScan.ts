/**
 * @file src/hooks/pda/useMatIssuingScan.ts
 * @description 자재출고 BOM 피킹 워크플로우 훅
 *
 * 초보자 가이드:
 * 1. **Phase 1 (SCAN_JOB_ORDER)**: 작업지시 바코드 스캔 → BOM 목록 세팅
 * 2. **Phase 2 (SCAN_MATERIAL)**: 자재시리얼 바코드 스캔 → BOM 항목별 수량 누적
 *    - BOM 외 자재 → NOT_IN_BOM 에러 반환
 *    - 요청수량 초과 → OVER_QTY 경고 반환 (추가는 허용)
 * 3. **Phase 3 (CONFIRM)**: 전체 스캔 완료 → 출고 확인 API 호출
 * 4. reset(): 전체 초기화 (다음 작업지시 준비)
 *
 * API:
 * - GET  /production/job-orders/order-no/:orderNo   — 작업지시 + BOM 조회
 * - GET  /material/lots/by-uid/:matUid              — LOT 재고 조회
 * - POST /material/issues/scan                      — 출고 처리
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type { BomCheckItem } from "@/components/pda/BomCheckList";

// ── 타입 정의 ─────────────────────────────────────────

/** 출고 플로우 단계 */
export type IssuingPhase = "SCAN_JOB_ORDER" | "SCAN_MATERIAL" | "CONFIRM";

/** 출고 유형 */
export type IssueType = "PRODUCTION" | "TRANSFER" | "RETURN";

/** BOM 항목 (스캔 LOT 이력 포함) */
export interface BomCheckItemWithLots extends BomCheckItem {
  /** 스캔된 LOT 목록 */
  scannedLots: Array<{ matUid: string; lotNo: string; qty: number }>;
}

/** 작업지시 요약 정보 */
export interface JobOrderSummary {
  id: number;
  orderNo: string;
  partCode: string;
  partName: string;
}

/** 출고 완료 이력 항목 */
export interface IssuingHistoryItem {
  orderNo: string;
  partCode: string;
  partName: string;
  totalScanned: number;
  timestamp: string;
}

/** handleScanMaterial 반환 결과 */
export type ScanMaterialResult =
  | "ok"
  | "over_qty"   // 수량 초과 (추가는 됨, 경고 표시용)
  | "not_in_bom" // BOM에 없는 자재
  | "error";

/** 서버에서 받는 작업지시 데이터 */
interface JobOrderApiData {
  id: number;
  orderNo: string;
  partCode: string;
  partName: string;
  bom?: Array<{
    itemCode: string;
    itemName: string;
    requiredQty: number;
  }>;
}

/** 서버에서 받는 LOT 데이터 */
interface MatLotApiData {
  matUid: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  remainQty: number;
  unit: string;
}

// ── 훅 반환 타입 ───────────────────────────────────────

interface UseMatIssuingScanReturn {
  phase: IssuingPhase;
  jobOrder: JobOrderSummary | null;
  bomItems: BomCheckItemWithLots[];
  issueType: IssueType;
  isScanning: boolean;
  isConfirming: boolean;
  error: string | null;
  history: IssuingHistoryItem[];
  setIssueType: (type: IssueType) => void;
  handleScanJobOrder: (barcode: string) => Promise<void>;
  handleScanMaterial: (barcode: string) => Promise<ScanMaterialResult>;
  handleConfirmIssue: () => Promise<boolean>;
  goToConfirm: () => void;
  reset: () => void;
}

// ── 훅 구현 ───────────────────────────────────────────

/**
 * 자재출고 BOM 피킹 워크플로우 훅
 *
 * 플로우:
 * SCAN_JOB_ORDER → (작업지시 스캔) → SCAN_MATERIAL → (자재 스캔 반복) → CONFIRM → (출고 확인) → 완료 후 리셋
 */
export function useMatIssuingScan(): UseMatIssuingScanReturn {
  const [phase, setPhase] = useState<IssuingPhase>("SCAN_JOB_ORDER");
  const [jobOrder, setJobOrder] = useState<JobOrderSummary | null>(null);
  const [bomItems, setBomItems] = useState<BomCheckItemWithLots[]>([]);
  const [issueType, setIssueType] = useState<IssueType>("PRODUCTION");
  const [isScanning, setIsScanning] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<IssuingHistoryItem[]>([]);

  // ── Phase 1: 작업지시 바코드 스캔 ────────────────────

  /**
   * 작업지시 바코드 스캔
   * - GET /production/job-orders/order-no/:orderNo 호출
   * - 성공 시 BOM 목록 세팅 → phase = SCAN_MATERIAL
   */
  const handleScanJobOrder = useCallback(async (barcode: string): Promise<void> => {
    if (!barcode.trim()) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data: jo } = await api.get<JobOrderApiData>(
        `/production/job-orders/order-no/${encodeURIComponent(barcode.trim())}`,
      );

      setJobOrder({
        id: jo.id,
        orderNo: jo.orderNo,
        partCode: jo.partCode,
        partName: jo.partName,
      });

      // BOM 항목 초기화 (스캔 이력 포함 확장형)
      const items: BomCheckItemWithLots[] = (jo.bom ?? []).map((b) => ({
        itemCode: b.itemCode,
        itemName: b.itemName,
        requiredQty: b.requiredQty,
        scannedQty: 0,
        checked: false,
        scannedLots: [],
      }));
      setBomItems(items);
      setPhase("SCAN_MATERIAL");
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "JOB_ORDER_NOT_FOUND";
      setError(message);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // ── Phase 2: 자재 바코드 스캔 ────────────────────────

  /**
   * 자재시리얼 바코드 스캔
   * - GET /material/lots/by-uid/:matUid 호출
   * - LOT itemCode가 bomItems에 없으면 NOT_IN_BOM 에러
   * - 있으면 scannedQty 누적, checked=true
   * - scannedQty > requiredQty면 OVER_QTY 경고 반환 (추가는 허용)
   */
  const handleScanMaterial = useCallback(
    async (barcode: string): Promise<ScanMaterialResult> => {
      if (!barcode.trim()) return "error";
      setIsScanning(true);
      setError(null);
      try {
        const { data: lot } = await api.get<MatLotApiData>(
          `/material/lots/by-uid/${encodeURIComponent(barcode.trim())}`,
        );

        // BOM 항목에서 해당 품목 찾기
        const idx = bomItems.findIndex((b) => b.itemCode === lot.itemCode);
        if (idx === -1) {
          setError("NOT_IN_BOM");
          return "not_in_bom";
        }

        // scannedQty 누적 + scannedLots 추가
        const updated = [...bomItems];
        const target = { ...updated[idx] };
        const newScannedQty = target.scannedQty + lot.remainQty;
        target.scannedQty = newScannedQty;
        target.checked = true;
        target.scannedLots = [
          ...target.scannedLots,
          { matUid: lot.matUid, lotNo: lot.lotNo, qty: lot.remainQty },
        ];
        updated[idx] = target;
        setBomItems(updated);

        // 수량 초과 여부 반환 (경고용)
        if (newScannedQty > target.requiredQty) {
          return "over_qty";
        }
        return "ok";
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "SCAN_FAILED";
        setError(message);
        return "error";
      } finally {
        setIsScanning(false);
      }
    },
    [bomItems],
  );

  // ── CONFIRM 단계로 진입 ───────────────────────────────

  /** SCAN_MATERIAL → CONFIRM 단계 전환 */
  const goToConfirm = useCallback(() => {
    setPhase("CONFIRM");
    setError(null);
  }, []);

  // ── Phase 3: 출고 확인 ───────────────────────────────

  /**
   * 출고 확인 처리
   * - POST /material/issues/scan — scannedLots 전체 전송
   * - 성공 시 이력 누적 → reset
   */
  const handleConfirmIssue = useCallback(async (): Promise<boolean> => {
    if (!jobOrder) return false;

    // 모든 scannedLots 수집
    const lots = bomItems.flatMap((b) => b.scannedLots);
    if (lots.length === 0) {
      setError("NO_SCANNED_LOTS");
      return false;
    }

    setIsConfirming(true);
    setError(null);
    try {
      await api.post("/material/issues/scan", {
        jobOrderId: jobOrder.id,
        issueType,
        lots: lots.map((l) => ({ matUid: l.matUid })),
      });

      // 이력 누적
      const totalScanned = bomItems.reduce((sum, b) => sum + b.scannedQty, 0);
      setHistory((prev) => [
        {
          orderNo: jobOrder.orderNo,
          partCode: jobOrder.partCode,
          partName: jobOrder.partName,
          totalScanned,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);

      // 전체 초기화
      setPhase("SCAN_JOB_ORDER");
      setJobOrder(null);
      setBomItems([]);
      setIssueType("PRODUCTION");
      return true;
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "ISSUE_FAILED";
      setError(message);
      return false;
    } finally {
      setIsConfirming(false);
    }
  }, [jobOrder, bomItems, issueType]);

  // ── 전체 초기화 ───────────────────────────────────────

  /** 전체 상태 초기화 (다음 작업지시 준비) */
  const reset = useCallback(() => {
    setPhase("SCAN_JOB_ORDER");
    setJobOrder(null);
    setBomItems([]);
    setIssueType("PRODUCTION");
    setError(null);
  }, []);

  return {
    phase,
    jobOrder,
    bomItems,
    issueType,
    isScanning,
    isConfirming,
    error,
    history,
    setIssueType,
    handleScanJobOrder,
    handleScanMaterial,
    handleConfirmIssue,
    goToConfirm,
    reset,
  };
}
