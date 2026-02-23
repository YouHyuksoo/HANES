/**
 * @file src/hooks/pda/useEquipInspectScan.ts
 * @description 설비 일상점검용 바코드 스캔 훅
 *
 * 초보자 가이드:
 * 1. handleScan(equipCode): 설비 바코드 스캔 → API에서 설비 정보 + 점검항목 조회
 * 2. handleSetResult(itemId, result): 각 점검항목에 합격/불합격/조건부 결과 설정
 * 3. handleSetRemark(itemId, remark): 각 점검항목에 비고 입력
 * 4. handleSubmit(): 점검 결과 일괄 제출 (POST /equipment/daily-inspect)
 * 5. handleReset(): 상태 초기화 (새 스캔 준비)
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";

/** 스캔된 설비 정보 */
export interface ScannedEquip {
  id: string;
  equipCode: string;
  equipName: string;
  location: string;
}

/** 점검 항목 (API 응답) */
export interface InspectItem {
  id: string;
  itemName: string;
  checkMethod: string;
  criteria: string;
}

/** 점검 결과 (사용자 입력) */
export interface InspectResult {
  itemId: string;
  result: "PASS" | "FAIL" | "CONDITIONAL";
  remark: string;
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
  handleScan: (equipCode: string) => Promise<void>;
  handleSetResult: (
    itemId: string,
    result: "PASS" | "FAIL" | "CONDITIONAL",
  ) => void;
  handleSetRemark: (itemId: string, remark: string) => void;
  handleSubmit: () => Promise<boolean>;
  handleReset: () => void;
}

/**
 * 설비 일상점검 스캔 훅
 *
 * 흐름:
 * 1. 설비 바코드 스캔 → 설비 정보 + 점검 체크리스트 로드
 * 2. 각 항목별 결과(PASS/FAIL/CONDITIONAL) 선택
 * 3. 비고 입력 (선택사항)
 * 4. 전체 제출
 */
export function useEquipInspectScan(): UseEquipInspectScanReturn {
  const [scannedEquip, setScannedEquip] = useState<ScannedEquip | null>(null);
  const [inspectItems, setInspectItems] = useState<InspectItem[]>([]);
  const [results, setResults] = useState<Map<string, InspectResult>>(new Map());
  const [isScanning, setIsScanning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 완료된 항목 수 */
  const completedCount = results.size;

  /** 모든 항목 결과 입력 여부 */
  const isAllCompleted =
    inspectItems.length > 0 && completedCount === inspectItems.length;

  /** 설비 바코드 스캔 → 설비 정보 + 점검항목 조회 */
  const handleScan = useCallback(async (equipCode: string) => {
    setIsScanning(true);
    setError(null);

    try {
      const { data } = await api.get(
        `/equipment/equip-master/by-code/${equipCode}`,
      );

      setScannedEquip({
        id: data.id,
        equipCode: data.equipCode,
        equipName: data.equipName,
        location: data.location || "",
      });

      // 점검항목 배열 (API 응답 구조에 따라 매핑)
      const items: InspectItem[] = (data.inspectItems || []).map(
        (item: Record<string, string>) => ({
          id: item.id,
          itemName: item.itemName,
          checkMethod: item.checkMethod || "",
          criteria: item.criteria || "",
        }),
      );
      setInspectItems(items);
      setResults(new Map());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Equipment scan failed";
      setError(message);
      setScannedEquip(null);
      setInspectItems([]);
    } finally {
      setIsScanning(false);
    }
  }, []);

  /** 점검항목 결과 설정 */
  const handleSetResult = useCallback(
    (itemId: string, result: "PASS" | "FAIL" | "CONDITIONAL") => {
      setResults((prev) => {
        const next = new Map(prev);
        const existing = next.get(itemId);
        next.set(itemId, {
          itemId,
          result,
          remark: existing?.remark || "",
        });
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

  /** 점검 결과 제출 */
  const handleSubmit = useCallback(async (): Promise<boolean> => {
    if (!scannedEquip || !isAllCompleted) return false;

    setIsSubmitting(true);
    setError(null);

    try {
      await api.post("/equipment/daily-inspect", {
        equipId: scannedEquip.id,
        results: Array.from(results.values()),
      });
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Inspection submit failed";
      setError(message);
      return false;
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
    handleScan,
    handleSetResult,
    handleSetRemark,
    handleSubmit,
    handleReset,
  };
}
