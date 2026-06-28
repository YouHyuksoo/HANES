"use client";

/**
 * @file src/app/(authenticated)/equipment/pm-plan/page.tsx
 * @description PM(예방보전) 계획 마스터 페이지 — DataGrid + 우측 슬라이드 패널 CRUD
 *
 * 초보자 가이드:
 * 1. **DataGrid**: PM 계획 목록 (코드, 설비, 주기, 다음예정일 등)
 * 2. **우측 패널**: 추가/수정 폼은 우측 슬라이드 패널에서 처리
 * 3. **필터**: PM유형 + 검색어
 * 4. API: GET/POST/PUT/DELETE /equipment/pm-plans
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Wrench, Plus, RefreshCw, Search, Calendar,
} from "lucide-react";
import {
  Button, Input, StatCard,
  ConfirmModal,
} from "@/components/ui";
import { Card, CardContent } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ComCodeSelect } from "@/components/shared";
import DateRangeFilter from "@/components/shared/DateRangeFilter";
import PmPlanPanel from "./components/PmPlanPanel";
import api from "@/services/api";
import { createPmPlanGridColumns } from "./pmPlanColumns";
import type { PmPlanRow } from "./types";

export default function PmPlanPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<PmPlanRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pmTypeFilter, setPmTypeFilter] = useState("");
  const [dueDateFrom, setDueDateFrom] = useState("");
  const [dueDateTo, setDueDateTo] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PmPlanRow | null>(null);
  const panelAnimateRef = useRef(true);

  const [deleteTarget, setDeleteTarget] = useState<PmPlanRow | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 5000 };
      if (search) params.search = search;
      if (pmTypeFilter) params.pmType = pmTypeFilter;
      if (dueDateFrom) params.dueDateFrom = dueDateFrom;
      if (dueDateTo) params.dueDateTo = dueDateTo;
      const res = await api.get("/equipment/pm-plans", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [search, pmTypeFilter, dueDateFrom, dueDateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const totalPlans = data.length;
    const timeBased = data.filter((d) => d.pmType === "TIME_BASED").length;
    const usageBased = data.filter((d) => d.pmType === "USAGE_BASED").length;
    const inactive = data.filter((d) => d.useYn === "N").length;
    return { totalPlans, timeBased, usageBased, inactive };
  }, [data]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingPlan(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/equipment/pm-plans/${deleteTarget.planCode}`);
      fetchData();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo(() => createPmPlanGridColumns({
    t,
    isPanelOpen,
    onEditPlan: (plan, shouldAnimate) => {
      panelAnimateRef.current = shouldAnimate;
      setEditingPlan(plan);
      setIsPanelOpen(true);
    },
    onDeletePlan: setDeleteTarget,
  }), [t, isPanelOpen]);

  return (
    <div className="flex h-full animate-fade-in">
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-4">
        {/* Header */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <Wrench className="w-7 h-7 text-primary" />
              {t("equipment.pmPlan.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("equipment.pmPlan.description")} ({data.length}{t("common.cases", "건")})</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingPlan(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("equipment.pmPlan.addPlan")}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <StatCard label={t("common.total")} value={stats.totalPlans} icon={Wrench} color="blue" />
          <StatCard label={t("equipment.pmPlan.timeBased")} value={stats.timeBased} icon={Calendar} color="green" />
          <StatCard label={t("equipment.pmPlan.usageBased")} value={stats.usageBased} icon={Wrench} color="yellow" />
          <StatCard label={t("common.inactive")} value={stats.inactive} icon={Wrench} color="gray" />
        </div>

        {/* DataGrid */}
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("equipment.pmPlan.title")}
            onRowClick={(row) => { panelAnimateRef.current = !isPanelOpen; setEditingPlan(row); setIsPanelOpen(true); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0 items-center">
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder={t("common.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                </div>
                <div className="w-32">
                  <ComCodeSelect groupCode="PM_TYPE" value={pmTypeFilter} onChange={setPmTypeFilter} labelPrefix={t("equipment.pmPlan.pmType", "PM유형")} fullWidth />
                </div>
                <DateRangeFilter from={dueDateFrom} to={dueDateTo} onFromChange={setDueDateFrom} onToChange={setDueDateTo} className="flex-shrink-0" />
              </div>
            }
          
          sqlQuery={`SELECT *\nFROM PM_PLANS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {/* Right Panel */}
      {isPanelOpen && (
        <PmPlanPanel
          key={editingPlan?.planCode ?? "__new__"}
          editingPlan={editingPlan}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={t("equipment.pmPlan.deleteConfirm", {
          name: `${deleteTarget?.planCode} - ${deleteTarget?.planName}`,
          defaultValue: `'${deleteTarget?.planCode} - ${deleteTarget?.planName}'을(를) 삭제하시겠습니까?`,
        })}
      />
    </div>
  );
}
