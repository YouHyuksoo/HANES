"use client";

import { useCallback, useMemo, useState } from "react";
import { planAssemblySgConsumption } from "@harness/shared";
import api from "@/services/api";

export interface AssemblySgLabel {
  sgBarcode: string;
  itemCode: string;
  remainQty: number;
  status: string;
  orderNo?: string | null;
  labelType?: string;
}

/** 스캔 세트는 화면 세션에만 보관한다. 잔량은 항상 서버 응답으로 갱신한다. */
export function useAssemblyScanSession(components: { itemCode: string; qtyPer: number }[]) {
  const [sgList, setSgList] = useState<AssemblySgLabel[]>([]);
  const [continuous, setContinuous] = useState(true);
  const isUsable = (label: AssemblySgLabel) =>
    Number.isFinite(label.remainQty) && label.remainQty > 0 && ["IN_STOCK", "MOUNTED"].includes(label.status);

  const ready = useMemo(() => {
    if (!components.length || !sgList.length) return false;
    try {
      return planAssemblySgConsumption(components, sgList).shortages.length === 0;
    } catch {
      return false;
    }
  }, [components, sgList]);

  const applyConfirmed = useCallback((labels?: AssemblySgLabel[]) => {
    // 구버전 응답처럼 잔량이 없을 때 추정하여 지속하지 않는다.
    if (!continuous || !Array.isArray(labels)) {
      setSgList([]);
      return;
    }
    const byBarcode = new Map(labels.map((label) => [label.sgBarcode, label]));
    setSgList((previous) => previous.flatMap((label) => {
      const fresh = byBarcode.get(label.sgBarcode);
      return fresh && isUsable(fresh) ? [{ ...label, ...fresh }] : [];
    }));
  }, [continuous]);

  const refreshAfterFailure = useCallback(async () => {
    const fresh = await Promise.allSettled(sgList.map(async (label) => {
      const res = await api.get(`/production/subprocess-kitting/sg-label/${encodeURIComponent(label.sgBarcode)}`, { suppressErrorModal: true });
      return res.data?.data as AssemblySgLabel;
    }));
    setSgList(fresh.flatMap((result) => result.status === "fulfilled" && result.value && isUsable(result.value) ? [result.value] : []));
  }, [sgList]);

  return { sgList, setSgList, continuous, setContinuous, ready, applyConfirmed, refreshAfterFailure };
}
