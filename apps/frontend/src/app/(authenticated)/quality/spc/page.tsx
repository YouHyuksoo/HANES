"use client";

/**
 * @file src/app/(authenticated)/quality/spc/page.tsx
 * @description SPC(통계적 공정 관리) 관리도 목록 페이지
 *
 * 초보자 가이드:
 * 1. **DataGrid**: SPC 관리도 목록 (chartNo, itemCode, processCode 등)
 * 2. **우측 패널**: 등록/수정(SpcFormPanel), 데이터 조회(SpcChartView)
 * 3. **ComCodeBadge**: chartType, status 코드값 표시
 * 4. **액션 버튼**: 관리한계 계산, Cpk 조회
 * 5. API: GET/POST /quality/spc/charts, POST calculate-limits, GET cpk
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Plus, RefreshCw, BarChart3, Search as SearchIcon,
  Calculator, TrendingUp, Eye, FileSearch, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import SpcFormPanel from "./components/SpcFormPanel";
import SpcChartView from "./components/SpcChartView";

/** SPC 관리도 데이터 타입 */
interface SpcChart {
  id: number;
  chartNo: string;
  itemCode: string;
  processCode: string;
  characteristicName: string;
  chartType: string;
  subgroupSize: number;
  usl: number | null;
  lsl: number | null;
  target: number | null;
  ucl: number | null;
  lcl: number | null;
  cl: number | null;
  dataSource: string;
  sourceInspectItem: string | null;
  status: string;
  createdAt: string;
}

export default function SpcPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SpcChart[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<SpcChart | null>(null);

  /* -- 필터 상태 -- */
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* -- 패널 상태 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SpcChart | null>(null);
  const [isChartViewOpen, setIsChartViewOpen] = useState(false);
  const [chartViewTarget, setChartViewTarget] = useState<SpcChart | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ label: string; action: () => Promise<void> } | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.chartType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/quality/spc/charts", { params });
      setData(res.data?.data ?? res.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 관리한계 계산 -- */
  const handleCalcLimits = useCallback(async () => {
    if (!selectedRow) return;
    await api.post(`/quality/spc/charts/calculate-limits/${selectedRow.chartNo}`);
    fetchData();
    setSelectedRow(null);
  }, [selectedRow, fetchData]);

  /* -- Cpk 조회 (차트뷰 열기) -- */
  const handleViewCpk = useCallback(() => {
    if (!selectedRow) return;
    setChartViewTarget(selectedRow);
    setIsChartViewOpen(true);
  }, [selectedRow]);

  /* -- 컬럼 정의 -- */
  const columns = useMemo<ColumnDef<SpcChart>[]>(() => [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedRow(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "chartNo", header: t("quality.spc.chartNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("quality.spc.itemCode"), size: 140,
      meta: { filterType: "text" as const } },
    { accessorKey: "processCode", header: t("quality.spc.processCode"), size: 100,
      meta: { filterType: "text" as const } },
    { accessorKey: "processName", header: t("master.process.processName"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "characteristicName", header: t("quality.spc.characteristicName"), size: 180,
      meta: { filterType: "text" as const } },
    { accessorKey: "chartType", header: t("quality.spc.chartType"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="SPC_CHART_TYPE" code={getValue() as string} /> },
    { accessorKey: "status", header: t("common.status"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="SPC_STATUS" code={getValue() as string} /> },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ], [t]);

  /* -- 행 선택 시 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    return (
      <div className="flex gap-2 flex-wrap">
        <Button size="sm" variant="secondary"
          onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
          <Eye className="w-4 h-4 mr-1" />{t("common.edit")}
        </Button>
        <Button size="sm"
          onClick={() => setConfirmAction({
            label: t("quality.spc.calculateLimits"),
            action: handleCalcLimits,
          })}>
          <Calculator className="w-4 h-4 mr-1" />{t("quality.spc.calculateLimits")}
        </Button>
        <Button size="sm" variant="secondary" onClick={handleViewCpk}>
          <TrendingUp className="w-4 h-4 mr-1" />{t("quality.spc.viewCpk")}
        </Button>
      </div>
    );
  }, [selectedRow, t, handleCalcLimits, handleViewCpk]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-primary" />{t("quality.spc.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.spc.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.spc.create")}
            </Button>
          </div>
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <Card className="flex-shrink-0"><CardContent><div className="flex items-center gap-3">
            <span className="text-sm text-text-muted font-medium">{selectedRow?.chartNo}</span>
            {actionButtons}
            <button onClick={() => setSelectedRow(null)}
              className="p-1 hover:bg-surface rounded transition-colors" title={t("common.close", "닫기")}>
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div></CardContent></Card>
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.spc.title")}
            getRowId={row => (row as SpcChart).chartNo}
            selectedRowId={selectedRow?.chartNo}
            onRowClick={(row) => { const r = row as SpcChart; setSelectedRow(r); setChartViewTarget(r); setIsChartViewOpen(true); }}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("common.search")} value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<SearchIcon className="w-4 h-4" />} fullWidth />
                </div>
                <ComCodeSelect groupCode="SPC_CHART_TYPE" value={typeFilter}
                  onChange={setTypeFilter} labelPrefix={t("quality.spc.chartType")} />
                <ComCodeSelect groupCode="SPC_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status")} />
              </div>
            }
          />
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />
      </div>

      {/* 우측 패널: 등록/수정 */}
      {isPanelOpen && (
        <SpcFormPanel editData={editTarget}
          onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
          onSave={fetchData} />
      )}

      {/* 우측 패널: 차트 데이터 조회 */}
      {isChartViewOpen && chartViewTarget && (
        <SpcChartView chart={chartViewTarget}
          onClose={() => { setIsChartViewOpen(false); setChartViewTarget(null); }} />
      )}
    </div>
  );
}
