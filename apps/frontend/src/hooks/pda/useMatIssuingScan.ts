/**
 * @file src/hooks/pda/useMatIssuingScan.ts
 * @description 자재출고 BOM 피킹 워크플로우 훅 (웹/PDA 백엔드 계약 통일)
 *
 * 초보자 가이드:
 * 1. **Phase 1 (SCAN_JOB_ORDER)**: 작업지시 바코드 스캔 → BOM 목록 세팅
 * 2. **Phase 2 (SCAN_MATERIAL)**: 자재시리얼 바코드 스캔 → BOM 항목별 수량 누적
 *    - BOM 외 자재 → NOT_IN_BOM 에러 반환
 *    - 요청수량 초과 → OVER_QTY 경고 반환 (추가는 허용)
 * 3. **Phase 3 (CONFIRM)**: 전체 스캔 완료 → 스캔 LOT마다 웹과 동일한
 *    바코드 스캔 출고 API(LOT 전량 출고)를 순차 호출
 * 4. reset(): 전체 초기화 (다음 작업지시 준비)
 *
 * API (웹 화면과 동일 계약):
 * - GET  /production/job-orders/order-no/:orderNo               — 작업지시 조회
 * - GET  /material/issue-requests/job-orders/:orderNo/bom-items — BOM 기준 출고예정 품목
 * - GET  /material/lots/by-uid/:matUid                          — LOT 재고 조회
 * - POST /material/issues/scan { matUid, issueType, ... }       — LOT 전량 스캔 출고
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import type { BomCheckItem } from "@/components/pda/BomCheckList";

// ── 타입 정의 ─────────────────────────────────────────

/** 출고 플로우 단계 */
export type IssuingPhase = "SCAN_JOB_ORDER" | "SCAN_MATERIAL" | "CONFIRM";

/** 출고 유형 (ComCode ISSUE_TYPE의 유효 코드만 사용) */
export type IssueType = "PRODUCTION" | "SAMPLE" | "RETURN";

/** BOM 항목 (스캔 LOT 이력 포함) */
export interface BomCheckItemWithLots extends BomCheckItem {
  /** 스캔된 LOT 목록 */
  scannedLots: Array<{ matUid: string; qty: number }>;
}

/** 작업지시 요약 정보 */
export interface JobOrderSummary {
  orderNo: string;
  itemCode: string;
  itemName: string;
}

/** 출고 완료 이력 항목 */
export interface IssuingHistoryItem {
  orderNo: string;
  itemCode: string;
  itemName: string;
  totalScanned: number;
  timestamp: string;
}

/** handleScanMaterial 반환 결과 */
export type ScanMaterialResult =
  | "ok"
  | "over_qty"   // 수량 초과 (추가는 됨, 경고 표시용)
  | "not_in_bom" // BOM에 없는 자재
  | "error";

/** 서버에서 받는 작업지시 데이터 (envelope.data) */
interface JobOrderApiData {
  orderNo: string;
  itemCode: string;
  part?: { itemCode: string; itemName: string } | null;
}

/** 서버에서 받는 BOM 출고예정 품목 (envelope.data[], 웹 출고요청과 동일 API) */
interface BomRequestItemApiData {
  itemCode: string;
  itemName: string;
  unit: string;
  requestQty: number;
}

/** 서버에서 받는 LOT 데이터 (envelope.data) */
interface MatLotApiData {
  matUid: string;
  itemCode: string;
  itemName: string;
  currentQty: number;
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
    const orderNo = barcode.trim();
    if (!orderNo) return;
    setIsScanning(true);
    setError(null);
    try {
      const { data: joRes } = await api.get<{ data: JobOrderApiData }>(
        `/production/job-orders/order-no/${encodeURIComponent(orderNo)}`,
      );
      const jo = joRes?.data;
      if (!jo?.orderNo) {
        setError("JOB_ORDER_NOT_FOUND");
        return;
      }

      // BOM 기준 출고예정 품목 (웹 출고요청 화면과 동일 API)
      const { data: bomRes } = await api.get<{ data: BomRequestItemApiData[] }>(
        `/material/issue-requests/job-orders/${encodeURIComponent(orderNo)}/bom-items`,
      );
      const bomList = bomRes?.data ?? [];
      if (bomList.length === 0) {
        setError("BOM_NOT_FOUND");
        return;
      }

      setJobOrder({
        orderNo: jo.orderNo,
        itemCode: jo.itemCode,
        itemName: jo.part?.itemName ?? jo.itemCode,
      });

      // BOM 항목 초기화 (스캔 이력 포함 확장형)
      const items: BomCheckItemWithLots[] = bomList.map((b) => ({
        itemCode: b.itemCode,
        itemName: b.itemName,
        requiredQty: b.requestQty,
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
      const matUid = barcode.trim();
      if (!matUid) return "error";
      setIsScanning(true);
      setError(null);
      try {
        // 같은 LOT 중복 스캔 방지
        if (bomItems.some((b) => b.scannedLots.some((l) => l.matUid === matUid))) {
          setError("DUPLICATE_LOT");
          return "error";
        }

        const { data: lotRes } = await api.get<{ data: MatLotApiData }>(
          `/material/lots/by-uid/${encodeURIComponent(matUid)}`,
        );
        const lot = lotRes?.data;
        if (!lot?.matUid) {
          setError("SCAN_FAILED");
          return "error";
        }
        if ((lot.currentQty ?? 0) <= 0) {
          setError("LOT_DEPLETED");
          return "error";
        }

        // BOM 항목에서 해당 품목 찾기
        const idx = bomItems.findIndex((b) => b.itemCode === lot.itemCode);
        if (idx === -1) {
          setError("NOT_IN_BOM");
          return "not_in_bom";
        }

        // scannedQty 누적 + scannedLots 추가 (스캔 출고는 LOT 전량 출고)
        const updated = [...bomItems];
        const target = { ...updated[idx] };
        const newScannedQty = target.scannedQty + lot.currentQty;
        target.scannedQty = newScannedQty;
        target.checked = true;
        target.scannedLots = [
          ...target.scannedLots,
          { matUid: lot.matUid, qty: lot.currentQty },
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
   * - 스캔 LOT마다 웹과 동일 계약 POST /material/issues/scan { matUid, issueType } 호출
   *   (백엔드 scanIssue = LOT 전량 출고, IQC/재고/HOLD 검증 포함)
   * - 작업지시 연계는 remark로 기록
   * - 부분 실패 시: 성공분은 출고된 상태 유지, 실패 LOT만 스캔 목록에 남기고 에러 표시
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

    const failed: string[] = [];
    let firstErrorMessage: string | null = null;
    for (const lot of lots) {
      try {
        await api.post("/material/issues/scan", {
          matUid: lot.matUid,
          issueType,
          remark: `PDA 작업지시 출고: ${jobOrder.orderNo}`,
        });
      } catch (err: unknown) {
        failed.push(lot.matUid);
        if (!firstErrorMessage) {
          firstErrorMessage =
            (err as { response?: { data?: { message?: string } } })?.response
              ?.data?.message || "ISSUE_FAILED";
        }
      }
    }

    setIsConfirming(false);

    if (failed.length > 0) {
      // 성공한 LOT은 스캔 목록에서 제거하고 실패분만 남긴다
      setBomItems((prev) =>
        prev.map((b) => {
          const remainLots = b.scannedLots.filter((l) => failed.includes(l.matUid));
          return {
            ...b,
            scannedLots: remainLots,
            scannedQty: remainLots.reduce((sum, l) => sum + l.qty, 0),
            checked: remainLots.length > 0,
          };
        }),
      );
      setError(`${firstErrorMessage} (실패 ${failed.length}건: ${failed.join(", ")})`);
      return false;
    }

    // 이력 누적
    const totalScanned = bomItems.reduce((sum, b) => sum + b.scannedQty, 0);
    setHistory((prev) => [
      {
        orderNo: jobOrder.orderNo,
        itemCode: jobOrder.itemCode,
        itemName: jobOrder.itemName,
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
