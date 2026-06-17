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
  category?: string | null;
  imageUrl?: string | null;
  stockQty?: number;
  expectedLife?: number | null;
  location?: string | null;
}

interface UseConLabelIssueParams {
  filteredMasters: LabelableMaster[];
  selectedCodes: Set<string>;
  qtyMap: Map<string, number>;
  onRefresh: () => void;
}

function getApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const maybeResponse = err as { response?: { data?: { message?: unknown; error?: unknown } }; message?: unknown };
    const serverMessage = maybeResponse.response?.data?.message ?? maybeResponse.response?.data?.error;
    if (typeof serverMessage === "string" && serverMessage.trim()) {
      return serverMessage;
    }
    if (typeof maybeResponse.message === "string" && maybeResponse.message.trim()) {
      return maybeResponse.message;
    }
  }
  return "UID 발행 중 오류가 발생했습니다.";
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
        allCreated.push(...items.map((item) => ({
          ...item,
          category: master.category,
          imageUrl: master.imageUrl,
          stockQty: master.stockQty,
          expectedLife: master.expectedLife,
          location: master.location,
        })));
      }
      setCreatedUids(allCreated);
      onRefresh();
      return allCreated;
    } catch (err) {
      throw new Error(getApiErrorMessage(err));
    } finally {
      setIssuing(false);
    }
  }, [filteredMasters, selectedCodes, qtyMap, onRefresh]);

  /** 브라우저 인쇄 로그 기록 */
  const logBrowserPrint = useCallback(async (conUids: string[]) => {
    try {
      await api.post("/material/label-print/log", {
        category: "con_uid", printMode: "BROWSER",
        uidList: conUids, labelCount: conUids.length, status: "SUCCESS",
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
