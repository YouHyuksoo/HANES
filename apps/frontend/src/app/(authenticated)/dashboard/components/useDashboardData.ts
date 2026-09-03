"use client";

/**
 * @file src/app/(authenticated)/dashboard/components/useDashboardData.ts
 * @description 대시보드 데이터 훅 — 4개 API 를 병렬 호출하고 60초마다 자동 갱신한다.
 *
 * 초보자 가이드:
 * 1. GET /dashboard/summary?date=오늘         : 설비/작업지시/자재알림/불량/점검 3종
 * 2. GET /monitoring/boards/production        : 작업지시 KPI + 목록 + 시간대별 실적
 * 3. GET /monitoring/boards/quality           : 불량률/수리/7일 추이
 * 4. GET /monitoring/boards/inventory         : 안전재고 미달/기한 LOT/보류 재고/금일 입출고
 * 5. 일부 API 가 실패해도 나머지는 표시한다 (allSettled). 실패 API 는 이전 값 유지.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { getTodayLocal } from "@/utils/date";
import type { DashboardData, DashboardSummary, InventoryBoardData, ProductionBoardData, QualityBoardData } from "./types";

const REFRESH_MS = 60_000;

async function fetchData<T>(url: string, params?: Record<string, string>): Promise<T> {
  const res = await api.get(url, { params });
  return res.data.data as T;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData>({ summary: null, production: null, quality: null, inventory: null });
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    const today = getTodayLocal();
    const [summary, production, quality, inventory] = await Promise.allSettled([
      fetchData<DashboardSummary>("/dashboard/summary", { date: today }),
      fetchData<ProductionBoardData>("/monitoring/boards/production"),
      fetchData<QualityBoardData>("/monitoring/boards/quality"),
      fetchData<InventoryBoardData>("/monitoring/boards/inventory"),
    ]);
    setData((prev) => ({
      summary: summary.status === "fulfilled" ? summary.value : prev.summary,
      production: production.status === "fulfilled" ? production.value : prev.production,
      quality: quality.status === "fulfilled" ? quality.value : prev.quality,
      inventory: inventory.status === "fulfilled" ? inventory.value : prev.inventory,
    }));
    setUpdatedAt(new Date());
    setLoading(false);
    inFlight.current = false;
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { data, loading, updatedAt, refresh };
}
