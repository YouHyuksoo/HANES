"use client";

/**
 * @file inspection/terminal-result/page.tsx
 * @description 절압물검사 (메뉴코드 INSP_TERMINAL_RESULT, 검사유형 TERMINAL)
 *
 * 초보자 가이드:
 * 1. 좌측: 진행/대기 중인 압착(CRIMPING) 작업지시. 라우팅의 CRINS(절압물검사)는 작업지시가 없어 앞 압착 작업지시에 기록한다.
 * 2. 우측: 단자별 압착 규격 대비 실측값 + 외관 판정을 초·중·종물로 등록한다(CrimpInspectPanel).
 * 3. FG 라벨이 생기기 전 반제품 검사라 FG 라벨·회로라벨을 쓰지 않는다.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw, Ruler, Search } from "lucide-react";
import { Button, Card, CardContent, ComCodeBadge, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import CrimpInspectPanel from "./components/CrimpInspectPanel";
import type { CrimpOrderRow } from "./types";

export default function CrimpInspectPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<CrimpOrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CrimpOrderRow | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 300);
    return () => clearTimeout(timer);
  }, [searchText]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/quality/crimp-inspect/job-orders");
      const rows: CrimpOrderRow[] = res.data?.data ?? [];
      setOrders(rows);
      setSelected((prev) => (prev ? rows.find((r) => r.orderNo === prev.orderNo) ?? null : prev));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchOrders(); }, [fetchOrders]);

  const filtered = useMemo(() => {
    if (!debouncedSearch) return orders;
    const q = debouncedSearch.toLowerCase();
    return orders.filter((o) =>
      o.orderNo.toLowerCase().includes(q)
      || o.itemCode.toLowerCase().includes(q)
      || (o.itemName ?? "").toLowerCase().includes(q),
    );
  }, [orders, debouncedSearch]);

  const columns = useMemo<ColumnDef<CrimpOrderRow>[]>(() => [
    {
      accessorKey: "orderNo", header: t("production.result.orderNo"), size: 120,
      cell: ({ getValue }) => <span className="font-mono font-semibold text-text">{getValue() as string}</span>,
    },
    {
      id: "item", header: t("master.part.partName"), size: 150,
      accessorFn: (o) => o.itemName ?? o.itemCode,
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="text-xs text-text truncate">{row.original.itemCode}</div>
          <div className="text-[11px] text-text-muted truncate">{row.original.processName ?? row.original.processCode}</div>
        </div>
      ),
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => <ComCodeBadge groupCode="JOB_ORDER_STATUS" code={getValue() as string} />,
      meta: { align: "center" },
    },
    {
      accessorKey: "inspectCount", header: t("inspection.terminalResult.inspectCount", "검사"), size: 70,
      cell: ({ row }) => (
        <span className="tabular-nums text-xs">
          {row.original.inspectCount.toLocaleString()}
          {row.original.failCount > 0 && <span className="ml-1 text-red-600 dark:text-red-400">({row.original.failCount})</span>}
        </span>
      ),
      meta: { align: "right" },
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Ruler className="w-7 h-7 text-primary" />
            {t("inspection.terminalResult.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("inspection.terminalResult.description")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void fetchOrders()}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
        <Card className="col-span-4 min-h-0 overflow-hidden flex flex-col" padding="none">
          <CardContent className="flex flex-col h-full min-h-0 p-3 gap-2">
            <div className="text-sm font-semibold text-text">{t("inspection.terminalResult.orders", "압착 작업지시")}</div>
            <Input
              placeholder={t("inspection.terminalResult.searchPlaceholder")}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              fullWidth
            />
            <div className="flex-1 min-h-0">
              <DataGrid
                data={filtered}
                columns={columns}
                pageSize={100}
                isLoading={loading}
                enableColumnFilter={false}
                enableColumnReordering={false}
                onRowClick={(row) => setSelected(row)}
                selectedRowId={selected?.orderNo}
                getRowId={(row) => row.orderNo}
                sqlQuery={`SELECT jo.*
FROM JOB_ORDERS jo
JOIN PROCESS_MASTERS pm ON pm.COMPANY = jo.COMPANY AND pm.PLANT_CD = jo.PLANT_CD AND pm.PROCESS_CODE = jo.PROCESS_CODE
WHERE jo.COMPANY = :company
  AND jo.PLANT_CD = :plant
  AND pm.PROCESS_TYPE = 'CRIMPING'
  AND jo.STATUS IN ('RUNNING', 'WAITING')`}
              />
            </div>
          </CardContent>
        </Card>

        <div className="col-span-8 min-h-0 overflow-hidden flex flex-col">
          {selected ? (
            <CrimpInspectPanel key={selected.orderNo} order={selected} onSaved={() => void fetchOrders()} />
          ) : (
            <Card className="flex-1 flex items-center justify-center">
              <CardContent>
                <div className="text-center text-text-muted">
                  <Ruler className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>{t("inspection.terminalResult.selectOrder")}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
