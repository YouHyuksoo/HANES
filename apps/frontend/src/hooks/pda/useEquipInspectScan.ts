/**
 * @file src/hooks/pda/useEquipInspectScan.ts
 * @description 설비 일상점검용 바코드 스캔 훅
 *
 * 초보자 가이드:
 * 1. handleScan(equipCode): 설비 바코드 스캔 → 설비 정보 + 점검항목 2단계 조회
 *    - GET /equipment/equips/code/{code} → 설비 정보
 *    - GET /master/equip-inspect-items?equipCode={code}&inspectType=DAILY&useYn=Y → 점검항목
 *    - 이미 오늘 점검 완료 시 → alreadyInspected=true 반환 (경고 후 재기록 허용)
 * 2. handleSetResult(itemId, result): 각 점검항목에 합격/불합격/조건부 결과 설정
 *    - FAIL 선택 시 → 해당 항목 reasonCode/reasonText 필드 활성화
 * 3. handleSetMeasuredValue(itemId, value): 각 점검항목에 측정값 입력
 * 4. handleSetRemark(itemId, remark): 각 점검항목에 비고 입력
 * 5. setItemReason(itemId, code, text): FAIL 항목의 사유코드 + 사유텍스트 설정
 * 6. handleSubmit(): 점검 결과 제출 (POST /equipment/daily-inspect)
 *    - overallResult에 FAIL이 있으면 interlockApplied=true 반환
 * 7. handleReset(): 상태 초기화 (새 스캔 준비)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** 스캔된 설비 정보 */
export interface ScannedEquip {
  id: string;
  equipCode: string;
  equipName: string;
  /** 라인코드 + 공정코드 조합 (예: "L01 / CUT") */
  lineProcess: string;
  /** 오늘 이미 점검 완료 여부 */
  alreadyInspected?: boolean;
}

/** 점검 항목 (API 응답 매핑) */
export interface InspectItem {
  id: string;
  itemName: string;
  criteria: string;
  seq: number;
}

/** 점검 결과 (사용자 입력) */
export interface InspectResult {
  itemId: string;
  result: "PASS" | "FAIL" | "CONDITIONAL";
  /** 실제 측정값 (예: "3.25mm", "0.6MPa") */
  measuredValue: string;
  remark: string;
  /** FAIL 선택 시 사유코드 (ComCode: INSPECT_NG_REASON) */
  reasonCode?: string;
  /** FAIL 선택 시 사유 텍스트 (ETC 직접입력 or 선택 라벨) */
  reasonText?: string;
}

/** 완료 이력 항목 */
export interface InspectHistoryItem {
  equipCode: string;
  equipName: string;
  overallResult: "PASS" | "FAIL" | "CONDITIONAL";
  itemCount: number;
  completedAt: string;
  /** 인터락 처리 여부 */
  interlockApplied?: boolean;
}

/** 제출 결과 */
export interface SubmitResult {
  success: boolean;
  /** FAIL 항목이 있어 인터락 처리됐는지 여부 */
  interlockApplied: boolean;
}

/** 훅 반환값 */
interface UseEquipInspectScanReturn {
  scannedEquip: ScannedEquip | null;
  inspectItems: InspectItem[];
  results: Map<string, InspectResult>;
  isScanning: boolean;
  isSubmitting: boolean;
  error: string | null;
  completedCount: number;
  isAllCompleted: boolean;
  history: InspectHistoryItem[];
  handleScan: (equipCode: string) => Promise<void>;
  handleSetResult: (
    itemId: string,
    result: "PASS" | "FAIL" | "CONDITIONAL",
  ) => void;
  handleSetMeasuredValue: (itemId: string, value: string) => void;
  handleSetRemark: (itemId: string, remark: string) => void;
  setItemReason: (itemId: string, code: string, text?: string) => void;
  handleSubmit: () => Promise<SubmitResult>;
  handleReset: () => void;
}

/**
 * overallResult 자동 계산:
 * - FAIL이 1개 이상 → "FAIL"
 * - CONDITIONAL만 있으면 → "CONDITIONAL"
 * - 전부 PASS → "PASS"
 */
function calcOverallResult(
  resultMap: Map<string, InspectResult>,
): "PASS" | "FAIL" | "CONDITIONAL" {
  const values = Array.from(resultMap.values());
  if (values.some((r) => r.result === "FAIL")) return "FAIL";
  if (values.some((r) => r.result === "CONDITIONAL")) return "CONDITIONAL";
  return "PASS";
}

/**
 * 설비 일상점검 스캔 훅
 *
 * 흐름:
 * 1. 설비 바코드 스캔 → 설비 정보 + 점검 체크리스트 로드
 *    - 이미 점검 완료된 설비: alreadyInspected=true 경고 반환 (재기록은 허용)
 * 2. 각 항목별 결과(PASS/FAIL/CONDITIONAL) 선택
 *    - FAIL 선택 시 → ReasonCodeSelect 표시
 * 3. 비고 입력 (선택사항)
 * 4. 전체 제출
 *    - FAIL 포함 시 → 인터락 처리 안내 (interlockApplied=true)
 */
export function useEquipInspectScan(): UseEquipInspectScanReturn {
  const [scannedEquip, setScannedEquip] = useState<ScannedEquip | null>(null);
  const [inspectItems, setInspectItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Map<string, InspectResult>>(new Map());
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<InspectHistoryItem[]>([]);

  /** 완료된 항목 수 */
  const completedCount = results.size;

  /** 모든 항목 결과 입력 여부 */
  const isAllCompleted =
    inspectItems.length > 0 && completedCount === inspectItems.length;

  /** 설비 바코드 스캔 → 설비 정보 + 점검항목 2단계 조회 */
  const handleScan = useCallback(async (equipCode: string) => {
    setIsScanning(true);
    setError(null);

    try {
      // 1) 설비 정보 조회 — 응답: { success, data: { id, equipCode, ... } }
      const { data: equipRes } = await api.get(
        `/equipment/equips/code/${equipCode}`,
      );
      const equip = equipRes.data;

      const lineProcess = [equip.lineCode, equip.processCode]
        .filter(Boolean)
        .join(" / ");

      // 2) 오늘 이미 점검 완료 여부 확인 (선택적 API)
      let alreadyInspected = false;
      try {
        const today = new Date().toISOString().slice(0, 10);
        const { data: checkRes } = await api.get(
          "/equipment/daily-inspect/check",
          {
            params: { equipCode: equip.equipCode, inspectDate: today },
          },
        );
        alreadyInspected = !!checkRes?.data?.alreadyInspected;
      } catch {
        // 점검 여부 확인 API 없어도 계속 진행
        alreadyInspected = false;
      }

      setScannedEquip({
        id: equip.id,
        equipCode: equip.equipCode,
        equipName: equip.equipName,
        lineProcess: lineProcess || "-",
        alreadyInspected,
      });

      // 3) 해당 설비의 DAILY 점검항목 조회 — 응답: { success, data: [...], meta }
      const { data: itemsRes } = await api.get("/master/equip-inspect-items", {
        params: {
          equipCode: equip.equipCode,
          inspectType: "DAILY",
          useYn: "Y",
          limit: 100,
        },
      });

      const rawItems = Array.isArray(itemsRes.data)
        ? itemsRes.data
        : itemsRes.data || [];

      const items: InspectItem[] = rawItems.map(
        (item: Record<string, unknown>) => ({
          id: item.id as string,
          itemName: (item.itemName as string) || "",
          criteria: (item.criteria as string) || "",
          seq: (item.seq as number) || 0,
        }),
      );

      // seq 기준 정렬
      items.sort((a, b) => a.seq - b.seq);

      setInspectItems(items);
      setResults(new Map());
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message;
      const message =
        status === 404
          ? `설비를 찾을 수 없습니다: ${equipCode}`
          : serverMsg || "설비 스캔에 실패했습니다.";
      setError(message);
      setScannedEquip(null);
      setInspectItems([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  /**
   * 점검항목 결과 설정
   * FAIL로 변경 시 기존 reasonCode/reasonText 초기화
   * PASS/CONDITIONAL로 변경 시 reasonCode/reasonText 제거
   */
  const handleSetResult = useCallback(
    (itemId: string, result: "PASS" | "FAIL" | "CONDITIONAL") => {
      setResults((prev) => {
        const next = new Map(prev);
        const existing = next.get(itemId);
        next.set(itemId, {
          itemId,
          result,
          measuredValue: existing?.measuredValue || "",
          remark: existing?.remark || "",
          // FAIL이 아닐 경우 사유코드 초기화
          reasonCode: result === "FAIL" ? (existing?.reasonCode || "") : undefined,
          reasonText: result === "FAIL" ? (existing?.reasonText || "") : undefined,
        });
        return next;
      });
    },
    [],
  );

  /** 점검항목 측정값 설정 */
  const handleSetMeasuredValue = useCallback(
    (itemId: string, value: string) => {
      setResults((prev) => {
        const next = new Map(prev);
        const existing = next.get(itemId);
        if (existing) {
          next.set(itemId, { ...existing, measuredValue: value });
        }
        return next;
      });
    },
    [],
  );

  /** 점검항목 비고 설정 */
  const handleSetRemark = useCallback((itemId: string, remark: string) => {
    setResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemId);
      if (existing) {
        next.set(itemId, { ...existing, remark });
      }
      return next;
    });
  }, []);

  /**
   * FAIL 항목의 NG 사유코드 + 사유텍스트 설정
   * @param itemId - 점검항목 ID
   * @param code   - ComCode detailCode (INSPECT_NG_REASON 그룹)
   * @param text   - ETC 직접입력 텍스트 (선택사항)
   */
  const setItemReason = useCallback(
    (itemId: string, code: string, text?: string) => {
      setResults((prev) => {
        const next = new Map(prev);
        const existing = next.get(itemId);
        if (existing) {
          next.set(itemId, { ...existing, reasonCode: code, reasonText: text });
        }
        return next;
      });
    },
    [],
  );

  /** 점검 결과 제출 — 백엔드 CreateEquipInspectDto 구조에 맞춤 */
  const handleSubmit = useCallback(async (): Promise<SubmitResult> => {
    if (!scannedEquip || !isAllCompleted) {
      return { success: false, interlockApplied: false };
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const overallResult = calcOverallResult(results);
      const resultArray = Array.from(results.values());
      const interlockApplied = overallResult === "FAIL";

      await api.post("/equipment/daily-inspect", {
        equipCode: scannedEquip.equipCode,
        inspectType: "DAILY",
        inspectDate: new Date().toISOString().slice(0, 10),
        overallResult,
        details: {
          items: resultArray.map((r) => ({
            itemId: r.itemId,
            result: r.result,
            measuredValue: r.measuredValue || undefined,
            remark: r.remark || undefined,
            reasonCode: r.reasonCode || undefined,
            reasonText: r.reasonText || undefined,
          })),
        },
      });

      // 이력 추가
      setHistory((prev) => [
        {
          equipCode: scannedEquip.equipCode,
          equipName: scannedEquip.equipName,
          overallResult,
          itemCount: resultArray.length,
          completedAt: new Date().toLocaleTimeString(),
          interlockApplied,
        },
        ...prev,
      ]);

      return { success: true, interlockApplied };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Inspection submit failed";
      setError(message);
      return { success: false, interlockApplied: false };
    } finally {
      setIsSubmitting(false);
    }
  }, [scannedEquip, isAllCompleted, results]);

  /** 상태 초기화 */
  const handleReset = useCallback(() => {
    setScannedEquip(null);
    setInspectItems([]);
    setResults(new Map());
    setIsScanning(false);
    setIsSubmitting(false);
    setError(null);
  }, []);

  return {
    scannedEquip,
    inspectItems,
    results,
    isScanning,
    isSubmitting,
    error,
    completedCount,
    isAllCompleted,
    history,
    handleScan,
    handleSetResult,
    handleSetMeasuredValue,
    handleSetRemark,
    setItemReason,
    handleSubmit,
    handleReset,
  };
}
