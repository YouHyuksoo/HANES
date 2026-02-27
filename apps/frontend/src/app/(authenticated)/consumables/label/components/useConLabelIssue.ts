"use client";

/**
 * @file components/useConLabelIssue.ts
 * @description 소모품 라벨 발행 비즈니스 로직 훅 — conUid 생성 + 인쇄 로그
 *
 * 초보자 가이드:
 * 1. 선택된 마스터에 대해 POST /consumables/label/create 호출 → conUid 생성
 * 2. 생성된 conUid 목록을 상태로 관리
 * 3. page.tsx에서 이 훅을 사용하여 발행 흐름을 제어
 */
import { useState, useCallback } from "react";
import { api } from "@/services/api";
import { LabelableMaster } from "./ConLabelColumns";

/** POST create 응답 아이템 */
export interface CreatedConUid {
  conUid: string;
  consumableCode: string;
  consumableName: string;
}

interface UseConLabelIssueParams {
  filteredMasters: LabelableMaster[];
  selectedCodes: Set<string>;
  qtyMap: Map<string, number>;
  onRefresh: () => void;
}

/** 소모품 라벨 발행 비즈니스 로직 훅 */
export function useConLabelIssue({
  filteredMasters, selectedCodes, qtyMap, onRefresh,
}: UseConLabelIssueParams) {
  const [issuing, setIssuing] = useState(false);
  const [createdUids, setCreatedUids] = useState<CreatedConUid[]>([]);

  /** 선택된 마스터에 대해 conUid 생성 */
  const createConUids = useCallback(async (): Promise<CreatedConUid[]> => {
    const selected = filteredMasters.filter((m) => selectedCodes.has(m.consumableCode));
    if (selected.length === 0) return [];

    setIssuing(true);
    const allCreated: CreatedConUid[] = [];
    try {
      for (const master of selected) {
        const qty = qtyMap.get(master.consumableCode) ?? 1;
        const res = await api.post("/consumables/label/create", {
          consumableCode: master.consumableCode,
          qty,
        });
        const items: CreatedConUid[] = res.data?.data ?? res.data ?? [];
        allCreated.push(...items);
      }
      setCreatedUids(allCreated);
      onRefresh();
      return allCreated;
    } catch (err) {
      console.error("Failed to create conUids:", err);
      return allCreated;
    } finally {
      setIssuing(false);
    }
  }, [filteredMasters, selectedCodes, qtyMap, onRefresh]);

  /** 브라우저 인쇄 로그 기록 */
  const logBrowserPrint = useCallback(async (conUids: string[]) => {
    try {
      await api.post("/material/label-print/log", {
        category: "con_uid", printMode: "BROWSER",
        matUids: conUids, labelCount: conUids.length, status: "SUCCESS",
      });
    } catch { /* ignore logging errors */ }
  }, []);

  /** 생성 결과 초기화 */
  const clearCreatedUids = useCallback(() => setCreatedUids([]), []);

  return {
    issuing,
    createdUids,
    createConUids,
    logBrowserPrint,
    clearCreatedUids,
  };
}
