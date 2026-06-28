"use client";

/**
 * @file src/app/(authenticated)/quality/control-plan/page.tsx
 * @description 관리계획서(Control Plan) 페이지 -- IATF 16949 8.5.1.1
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 관리계획서 목록 (페이지네이션, 필터)
 * 2. **우측 패널**: 등록/수정(ControlPlanFormPanel) 슬라이드 패널
 * 3. **액션 버튼**: 승인(APPROVE), 개정(REVISE)
 * 4. API: GET/POST /quality/control-plans, PUT/DELETE /:planNo
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus, RefreshCw, ClipboardList, Search as SearchIcon,
  ShieldCheck, FileEdit, FileSearch, X,
} from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import api from "@/services/api";
import ControlPlanFormPanel from "./components/ControlPlanFormPanel";
import { createControlPlanGridColumns, ControlPlan } from "./controlPlanColumns";

/** 상태 전환 액션 */
interface ActionDef {
  label: string;
  action: () => Promise<void>;
}

export default function ControlPlanPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ControlPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<ControlPlan | null>(null);

  /* -- 필터 -- */
  const [searchText, setSearchText] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /* -- 패널 -- */
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ControlPlan | null>(null);
  const [confirmAction, setConfirmAction] = useState<ActionDef | null>(null);

  /* -- 데이터 조회 -- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (phaseFilter) params.phase = phaseFilter;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/quality/control-plans", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, phaseFilter, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* -- 승인 API -- */
  const handleApprove = useCallback(async (planNo: string) => {
    await api.patch(`/quality/control-plans/approve/${planNo}`);
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 개정 API -- */
  const handleRevise = useCallback(async (planNo: string) => {
    await api.post(`/quality/control-plans/revise/${planNo}`);
    fetchData();
    setSelectedRow(null);
  }, [fetchData]);

  /* -- 컬럼 -- */
  const columns = useMemo(
    () => createControlPlanGridColumns({ t, onSelectRow: setSelectedRow }),
    [t],
  );

  /* -- 액션 버튼 -- */
  const actionButtons = useMemo(() => {
    if (!selectedRow) return null;
    const s = selectedRow.status;
    return (
      <div className="flex gap-2 flex-wrap">
        {/* 모든 상태에서 상세보기 가능 */}
        <Button size="sm" variant="secondary"
          onClick={() => { setEditTarget(selectedRow); setIsPanelOpen(true); }}>
          <FileSearch className="w-4 h-4 mr-1" />{s === "DRAFT" ? t("common.edit") : t("common.detail", "상세")}
        </Button>
        {s === "DRAFT" && (
          <Button size="sm"
            onClick={() => setConfirmAction({
              label: t("quality.controlPlan.approve"),
              action: () => handleApprove(selectedRow.planNo),
            })}>
            <ShieldCheck className="w-4 h-4 mr-1" />{t("quality.controlPlan.approve")}
          </Button>
        )}
        {s === "APPROVED" && (
          <Button size="sm" variant="secondary"
            onClick={() => setConfirmAction({
              label: t("quality.controlPlan.revise"),
              action: () => handleRevise(selectedRow.planNo),
            })}>
            <FileEdit className="w-4 h-4 mr-1" />{t("quality.controlPlan.revise")}
          </Button>
        )}
      </div>
    );
  }, [selectedRow, t, handleApprove, handleRevise]);

  return (
    <div className="flex h-full">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ClipboardList className="w-7 h-7 text-primary" />{t("quality.controlPlan.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("quality.controlPlan.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { setEditTarget(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("quality.controlPlan.create")}
            </Button>
          </div>
        </div>

        {/* 액션 버튼 */}
        {actionButtons && (
          <div className="flex items-center gap-3 flex-shrink-0 px-1">
            <span className="text-xs text-text-muted font-medium">{selectedRow?.planNo}</span>
            {actionButtons}
            <button onClick={() => setSelectedRow(null)}
              className="p-1 hover:bg-surface rounded transition-colors" title={t("common.close", "닫기")}>
              <X className="w-4 h-4 text-text-muted" />
            </button>
          </div>
        )}

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("quality.controlPlan.title")}
            getRowId={row => (row as ControlPlan).planNo}
            selectedRowId={selectedRow?.planNo}
            toolbarLeft={
              <div className="flex gap-3 items-center flex-1 min-w-0 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <Input placeholder={t("common.search")} value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    leftIcon={<SearchIcon className="w-4 h-4" />} fullWidth />
                </div>
                <ComCodeSelect groupCode="CP_PHASE" value={phaseFilter}
                  onChange={setPhaseFilter} labelPrefix={t("quality.controlPlan.phase")} />
                <ComCodeSelect groupCode="CP_STATUS" value={statusFilter}
                  onChange={setStatusFilter} labelPrefix={t("common.status")} />
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM QA_CONTROL_PLANS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>

        {/* 확인 모달 */}
        <ConfirmModal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)}
          onConfirm={async () => { await confirmAction?.action(); setConfirmAction(null); }}
          title={confirmAction?.label ?? ""} message={`${confirmAction?.label ?? ""} ${t("common.confirm")}?`} />
      </div>

      {/* 등록/수정 모달 */}
      <ControlPlanFormPanel
        key={editTarget?.planNo ?? "__new__"}
        isOpen={isPanelOpen} editData={editTarget}
        onClose={() => { setIsPanelOpen(false); setEditTarget(null); }}
        onSave={fetchData} />
    </div>
  );
}
