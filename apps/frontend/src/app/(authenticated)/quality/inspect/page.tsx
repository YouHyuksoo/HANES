"use client";

/**
 * @file src/app/(authenticated)/quality/inspect/page.tsx
 * @description 외관검사 페이지 - 작업지시 선택 + FG_BARCODE 스캔 → 외관검사 판정 등록
 *
 * 초보자 가이드:
 * 1. 좌측에서 작업지시 선택 (통전검사와 동일한 2단 레이아웃)
 * 2. 우측 패널에서 제품(FG) 바코드 스캔 → 합격/불합격 판정
 * 3. 통전검사와 달리 검사기/소모품/회로라벨 스캔 절차는 없다.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { Eye, RefreshCw, Search, Maximize2, Minimize2 } from "lucide-react";
import { Card, CardContent, Button, Input } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeLabel } from "@/hooks/useComCode";
import api from "@/services/api";
import type { JobOrderRow } from "./types";
import VisualInspectPanel from "./components/VisualInspectPanel";

export default function VisualInspectPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<JobOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<JobOrderRow | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 브라우저 전체화면 상태 추적 */
  useEffect(() => {
    const handle = () => setIsFullscreen(Boolean(document.fullscreenElement));
    handle();
    document.addEventListener("fullscreenchange", handle);
    return () => document.removeEventListener("fullscreenchange", handle);
  }, []);

  const toggleMaximize = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen?.();
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchText]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/continuity-inspect/job-orders", {
        params: { finishedOnly: "true" },
      });
      setOrders(res.data?.data ?? []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  /** 작업지시가 정확히 1개이면 자동 선택 */
  useEffect(() => {
    if (orders.length === 1) setSelected(orders[0]);
  }, [orders]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return orders;
    const q = debouncedSearch.toLowerCase();
    return orders.filter(
      (o) =>
        o.orderNo.toLowerCase().includes(q) ||
        (o.itemName ?? "").toLowerCase().includes(q) ||
        o.itemCode.toLowerCase().includes(q),
    );
  }, [orders, debouncedSearch]);

  /** 상태별 그룹 — 진행중(RUNNING/IN_PROGRESS) 위, 대기중(WAITING) 아래, 섞지 않고 영역 분리 */
  const runningOrders = useMemo(() => filtered.filter((o) => o.status === "RUNNING" || o.status === "IN_PROGRESS"), [filtered]);
  const waitingOrders = useMemo(() => filtered.filter((o) => o.status === "WAITING"), [filtered]);
  const runningLabel = useComCodeLabel("JOB_ORDER_STATUS", "RUNNING");
  const waitingLabel = useComCodeLabel("JOB_ORDER_STATUS", "WAITING");

  /** 그리드 컬럼 — 지시번호 / 품명 / 상태 / 계획 / 양품 / 불량 */
  const columns = useMemo<ColumnDef<JobOrderRow>[]>(() => [
    {
      accessorKey: "orderNo", header: t("production.result.orderNo"), size: 120,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-text">{getValue() as string}</span>,
    },
    {
      id: "itemName", header: t("master.part.partName"), size: 140,
      accessorFn: (o) => o.itemName ?? o.itemCode,
      cell: ({ getValue }) => <span className="text-xs text-text-muted truncate">{getValue() as string}</span>,
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />,
      meta: { align: "center" },
    },
    {
      accessorKey: "planQty", header: t("inspection.result.planQty"), size: 70,
      cell: ({ getValue }) => <span className="tabular-nums text-xs">{(getValue() as number | undefined)?.toLocaleString() ?? "-"}</span>,
      meta: { align: "right", filterType: "number" },
    },
    {
      accessorKey: "goodQty", header: t("inspection.result.pass"), size: 70,
      cell: ({ getValue }) => <span className="tabular-nums text-xs text-green-600 dark:text-green-400">{(getValue() as number | undefined)?.toLocaleString() ?? "-"}</span>,
      meta: { align: "right", filterType: "number" },
    },
    {
      accessorKey: "defectQty", header: t("inspection.result.fail"), size: 70,
      cell: ({ getValue }) => <span className="tabular-nums text-xs text-red-600 dark:text-red-400">{(getValue() as number | undefined)?.toLocaleString() ?? "-"}</span>,
      meta: { align: "right", filterType: "number" },
    },
  ], [t]);

  /** 상태 그룹 헤더 */
  const renderGroupHeader = (label: string, count: number) => (
    <div className="flex items-center gap-2 px-1 pt-2 pb-1 first:pt-0">
      <span className="text-xs font-semibold text-text">{label}</span>
      <span className="text-xs text-text-muted tabular-nums">{count}</span>
      <div className="flex-1 border-t border-border" />
    </div>
  );

  /** 상태 그룹별 작업지시 그리드 */
  const renderOrderGrid = (rows: JobOrderRow[]) => (
    <DataGrid
      data={rows}
      columns={columns}
      pageSize={100}
      enableColumnFilter={false}
      enableColumnResizing={false}
      enableColumnReordering={false}
      onRowClick={(row) => setSelected(row)}
      selectedRowId={selected?.orderNo}
      getRowId={(row) => row.orderNo}
      sqlQuery={`SELECT *
FROM JOB_ORDERS jo
JOIN ITEM_MASTERS p ON p.ITEM_CODE = jo.ITEM_CODE
WHERE jo.COMPANY = :company
  AND jo.PLANT_CD = :plant
  AND jo.STATUS IN ('RUNNING', 'IN_PROGRESS', 'WAITING')
  AND p.ITEM_TYPE = 'FINISHED'
ORDER BY jo.PRIORITY ASC, jo.PLAN_DATE ASC`}
    />
  );

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Eye className="w-7 h-7 text-primary" />
            {t("quality.inspect.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("quality.inspect.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={fetchOrders}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            {t("common.refresh")}
          </Button>
          {/* 전체화면 토글 */}
          <button
            type="button"
            onClick={toggleMaximize}
            title={isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            aria-label={isFullscreen ? t("inspection.result.exitFullscreen") : t("inspection.result.fullscreen")}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="col-span-4 flex flex-col gap-4 min-h-0 overflow-hidden">
          <Card className="flex-1 min-h-0 overflow-hidden flex flex-col" padding="none">
            <CardContent className="flex flex-col h-full p-3 gap-2">
              <Input
                placeholder={t("quality.inspect.searchPlaceholder")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                fullWidth
              />
              <div className="flex-1 overflow-auto min-h-0">
                {filtered.length === 0 && !loading && (
                  <p className="text-sm text-text-muted text-center mt-8">
                    {t("common.noData")}
                  </p>
                )}
                {runningOrders.length > 0 && (
                  <>
                    {renderGroupHeader(runningLabel, runningOrders.length)}
                    {renderOrderGrid(runningOrders)}
                  </>
                )}
                {waitingOrders.length > 0 && (
                  <>
                    {renderGroupHeader(waitingLabel, waitingOrders.length)}
                    {renderOrderGrid(waitingOrders)}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-8 overflow-hidden flex flex-col">
          {selected ? (
            <VisualInspectPanel
              key={selected.orderNo}
              order={selected}
            />
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <CardContent>
                <div className="text-center text-text-muted">
                  <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t("inspection.result.selectOrder")}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
