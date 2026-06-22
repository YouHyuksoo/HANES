/**
 * @file src/app/(authenticated)/production/monthly-plan/page.tsx
 * @description 월간생산계획 관리 페이지 - 계획 등록/조회/엑셀 업로드
 *
 * 초보자 가이드:
 * 1. **레이아웃**: 좌측 메인(DataGrid) + 우측 슬라이드 패널
 * 2. **필터**: 월 선택, 품목유형(FG/WIP), 상태, 검색
 * 3. **엑셀 업로드**: xlsx 라이브러리로 프론트 파싱 → JSON 전송
 * 4. **상태 워크플로우**: DRAFT → CONFIRMED → CLOSED
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Search, RefreshCw, CalendarRange, Plus, Upload, Download, Edit2, Trash2, Wand2, Network } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import { useComCodeOptions } from "@/hooks/useComCode";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { ProdPlanItem } from "./components/types";
import { usePlanColumns } from "./components/PlanColumns";
import PlanFormPanel from "./components/PlanFormPanel";
import ExcelUploadModal from "./components/ExcelUploadModal";
import IssueJobOrderModal from "./components/IssueJobOrderModal";
import AutoGenerateModal from "./components/AutoGenerateModal";
import { downloadProdPlanTemplate } from "./components/prodPlanTemplate";

export default function MonthlyPlanPage() {
  const { t } = useTranslation();
  const comCodeStatusOptions = useComCodeOptions("PROD_PLAN_STATUS");

  const [data, setData] = useState<ProdPlanItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [itemTypeFilter, setItemTypeFilter] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-01-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-12-31`;
  });

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProdPlanItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProdPlanItem | null>(null);
  const [showExcel, setShowExcel] = useState(false);
  const [showAutoGen, setShowAutoGen] = useState(false);
  const [showErpNotice, setShowErpNotice] = useState(false);
  const [issueTarget, setIssueTarget] = useState<ProdPlanItem | null>(null);
  const panelAnimateRef = useRef(true);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.status") },
    ...comCodeStatusOptions,
  ], [t, comCodeStatusOptions]);

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
    } catch (err: unknown) {
      console.error("[MonthlyPlan] fetchData error:", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, searchText, statusFilter, itemTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleConfirm = useCallback(async (item: ProdPlanItem) => {
    try {
      await api.post(`/production/prod-plans/${item.planNo}/confirm`);
      fetchData();
    } catch { /* api interceptor */ }
  }, [fetchData]);

  const handleUnconfirm = useCallback(async (item: ProdPlanItem) => {
    try {
      await api.post(`/production/prod-plans/${item.planNo}/unconfirm`);
      fetchData();
    } catch { /* api interceptor */ }
  }, [fetchData]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/production/prod-plans/${deleteTarget.planNo}`);
      fetchData();
    } catch { /* api interceptor */ }
    finally { setDeleteTarget(null); }
  }, [deleteTarget, fetchData]);

  const columns = usePlanColumns({
    onConfirm: handleConfirm,
    onUnconfirm: handleUnconfirm,
    onIssue: (item) => setIssueTarget(item),
  });

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
    <div className="flex h-full animate-fade-in">
      {/* 좌측: 메인 콘텐츠 */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <CalendarRange className="w-7 h-7 text-primary" />
              {t("monthlyPlan.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("monthlyPlan.description")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button variant="secondary" size="sm"
              onClick={() => downloadProdPlanTemplate(t, startDate?.slice(0, 7) || new Date().toISOString().slice(0, 7))}>
              <Download className="w-4 h-4 mr-1" />{t("monthlyPlan.excel.downloadTemplate")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowExcel(true)}>
              <Upload className="w-4 h-4 mr-1" />{t("monthlyPlan.excelUpload")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowErpNotice(true)}>
              <Network className="w-4 h-4 mr-1" />{t("monthlyPlan.erpInterface")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAutoGen(true)}>
              <Wand2 className="w-4 h-4 mr-1" />{t("monthlyPlan.autoGenerate.button")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPlan(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("monthlyPlan.addPlan")}
            </Button>
          </div>
        </div>

        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
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
                <DateRangeFilter from={startDate} to={endDate} onFromChange={setStartDate} onToChange={setEndDate} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("monthlyPlan.searchPlaceholder")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-28 flex-shrink-0">
                  <ComCodeSelect groupCode="ITEM_TYPE" labelPrefix={t('common.itemType', '품목유형')} value={itemTypeFilter}
                    onChange={setItemTypeFilter} fullWidth />
                </div>
                <div className="w-28 flex-shrink-0">
                  <Select options={statusOptions} value={statusFilter}
                    onChange={setStatusFilter} fullWidth />
                </div>
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM PROD_MONTHLY_PLANS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {/* 우측: 패널 */}
      {isPanelOpen && (
        <PlanFormPanel
          key={editingPlan?.planNo ?? "__new__"}
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

      <AutoGenerateModal
        isOpen={showAutoGen}
        onClose={() => setShowAutoGen(false)}
        onSuccess={() => { setShowAutoGen(false); fetchData(); }}
      />

      <IssueJobOrderModal
        isOpen={!!issueTarget}
        onClose={() => setIssueTarget(null)}
        onSuccess={() => { setIssueTarget(null); fetchData(); }}
        plan={issueTarget}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        variant="danger"
        message={t("monthlyPlan.deleteConfirm", "'{{planNo}}'을(를) 삭제하시겠습니까?", { planNo: deleteTarget?.planNo || "" })}
      />

      {/* ERP 인터페이스 — 기능 미구현(준비중) 안내 */}
      <ConfirmModal
        isOpen={showErpNotice}
        onClose={() => setShowErpNotice(false)}
        onConfirm={() => setShowErpNotice(false)}
        title={t("monthlyPlan.erpInterface")}
        message={t("monthlyPlan.erpInterfaceNotReady")}
        confirmText={t("common.confirm")}
        cancelText={t("common.close")}
      />
    </div>
  );
}
