/**
 * @file src/app/(authenticated)/production/monthly-plan/page.tsx
 * @description 월간생산계획 관리 페이지 - 계획 등록/조회/엑셀 업로드
 *
 * 초보자 가이드:
 * 1. **레이아웃**: 좌측 메인(StatCards + DataGrid) + 우측 슬라이드 패널
 * 2. **필터**: 월 선택, 품목유형(FG/WIP), 상태, 검색
 * 3. **엑셀 업로드**: xlsx 라이브러리로 프론트 파싱 → JSON 전송
 * 4. **상태 워크플로우**: DRAFT → CONFIRMED → CLOSED
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, CalendarRange, Plus, Upload, Edit2, Trash2 } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal, StatCard } from "@/components/ui";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { ProdPlanItem, ProdPlanSummary } from "./components/types";
import { usePlanColumns } from "./components/PlanColumns";
import PlanFormPanel from "./components/PlanFormPanel";
import ExcelUploadModal from "./components/ExcelUploadModal";

export default function MonthlyPlanPage() {
  const { t } = useTranslation();
  const comCodeStatusOptions = useComCodeOptions("PROD_PLAN_STATUS");

  const [data, setData] = useState<ProdPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProdPlanItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProdPlanItem | null>(null);
  const [showExcel, setShowExcel] = useState(false);
  const panelAnimateRef = useRef(true);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.status") },
    ...comCodeStatusOptions,
  ], [t, comCodeStatusOptions]);

  const itemTypeOptions = useMemo(() => [
    { value: "", label: t("monthlyPlan.itemType") },
    { value: "FG", label: t("inventory.stock.fg", "완제품") },
    { value: "WIP", label: t("inventory.stock.wip", "반제품") },
  ], [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 5000 };
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (itemTypeFilter) params.itemType = itemTypeFilter;

      const res = await api.get("/production/prod-plans", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, searchText, statusFilter, itemTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats: ProdPlanSummary = useMemo(() => {
    const s: ProdPlanSummary = {
      total: data.length, draft: 0, confirmed: 0, closed: 0,
      fgCount: 0, wipCount: 0, fgPlanQty: 0, wipPlanQty: 0, totalPlanQty: 0, totalOrderQty: 0,
    };
    for (const p of data) {
      if (p.status === "DRAFT") s.draft++;
      else if (p.status === "CONFIRMED") s.confirmed++;
      else if (p.status === "CLOSED") s.closed++;
      if (p.itemType === "FG") { s.fgCount++; s.fgPlanQty += p.planQty; }
      else { s.wipCount++; s.wipPlanQty += p.planQty; }
      s.totalPlanQty += p.planQty;
      s.totalOrderQty += p.orderQty;
    }
    return s;
  }, [data]);

  const handleConfirm = useCallback(async (item: ProdPlanItem) => {
    try {
      await api.post(`/production/prod-plans/${item.id}/confirm`);
      fetchData();
    } catch { /* api interceptor */ }
  }, [fetchData]);

  const handleUnconfirm = useCallback(async (item: ProdPlanItem) => {
    try {
      await api.post(`/production/prod-plans/${item.id}/unconfirm`);
      fetchData();
    } catch { /* api interceptor */ }
  }, [fetchData]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/production/prod-plans/${deleteTarget.id}`);
      fetchData();
    } catch { /* api interceptor */ }
    finally { setDeleteTarget(null); }
  }, [deleteTarget, fetchData]);

  const columns = usePlanColumns({ onConfirm: handleConfirm, onUnconfirm: handleUnconfirm });

  const allColumns = useMemo(() => [
    {
      id: "rowActions",
      header: "",
      size: 60,
      meta: { filterType: "none" as const, align: "center" as const },
      cell: ({ row }: any) => {
        const item = row.original as ProdPlanItem;
        if (item.status !== "DRAFT") return null;
        return (
          <div className="flex gap-1">
            <button onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPlan(item); setIsPanelOpen(true); }}
              className="p-1 hover:bg-surface rounded">
              <Edit2 className="w-3.5 h-3.5 text-primary" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
              className="p-1 hover:bg-surface rounded">
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        );
      },
    },
    ...columns,
  ], [columns, isPanelOpen]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingPlan(null);
    panelAnimateRef.current = true;
  }, []);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <CalendarRange className="w-7 h-7 text-primary" />
              {t("monthlyPlan.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("monthlyPlan.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowExcel(true)}>
              <Upload className="w-4 h-4 mr-1" />{t("monthlyPlan.excelUpload")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPlan(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("monthlyPlan.addPlan")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <StatCard label={t("monthlyPlan.stats.total")} value={stats.total} icon={CalendarRange} color="blue" />
          <StatCard label={t("monthlyPlan.stats.draft")} value={stats.draft} icon={CalendarRange} color="yellow" />
          <StatCard label={t("monthlyPlan.stats.confirmed")} value={stats.confirmed} icon={CalendarRange} color="green" />
          <StatCard label={t("monthlyPlan.stats.closed")} value={stats.closed} icon={CalendarRange} color="purple" />
        </div>

        <Card><CardContent>
          <DataGrid
            data={data}
            columns={allColumns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("monthlyPlan.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingPlan(row as ProdPlanItem); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={startDate}
                    onChange={e => setStartDate(e.target.value)} fullWidth />
                </div>
                <div className="w-36 flex-shrink-0">
                  <Input type="date" value={endDate}
                    onChange={e => setEndDate(e.target.value)} fullWidth />
                </div>
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("monthlyPlan.searchPlaceholder")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-28 flex-shrink-0">
                  <Select options={itemTypeOptions} value={itemTypeFilter}
                    onChange={setItemTypeFilter} fullWidth />
                </div>
                <div className="w-28 flex-shrink-0">
                  <Select options={statusOptions} value={statusFilter}
                    onChange={setStatusFilter} fullWidth />
                </div>
                <Button variant="secondary" onClick={fetchData}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            }
          />
        </CardContent></Card>
      </div>

      {/* 우측: 패널 */}
      {isPanelOpen && (
        <PlanFormPanel
          editingPlan={editingPlan}
          defaultMonth={startDate?.slice(0, 7) || new Date().toISOString().slice(0, 7)}
          onClose={handlePanelClose}
          onSave={fetchData}
          animate={panelAnimateRef.current}
        />
      )}

      <ExcelUploadModal
        isOpen={showExcel}
        onClose={() => setShowExcel(false)}
        onUploaded={fetchData}
        planMonth={startDate?.slice(0, 7) || new Date().toISOString().slice(0, 7)}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        variant="danger"
        message={`'${deleteTarget?.planNo || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
