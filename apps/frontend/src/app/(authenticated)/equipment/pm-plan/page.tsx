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
  Wrench, Plus, RefreshCw, Search, Calendar, Edit2, Trash2,
} from "lucide-react";
import {
  Button, Input, Select, StatCard,
  ConfirmModal, ComCodeBadge,
} from "@/components/ui";
import { Card, CardContent } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import PmPlanPanel from "./components/PmPlanPanel";
import api from "@/services/api";
import type { ColumnDef } from "@tanstack/react-table";

interface PmPlanRow {
  id: string;
  planCode: string;
  planName: string;
  pmType: string;
  cycleType: string;
  cycleValue: number;
  cycleUnit: string;
  equipId: string;
  estimatedTime: number | null;
  description: string;
  nextDueAt: string | null;
  useYn: string;
  itemCount: number;
  equip: {
    id: string;
    equipCode: string;
    equipName: string;
    lineCode: string | null;
    equipType: string | null;
  } | null;
}

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

  const pmTypeOptions = useComCodeOptions("PM_TYPE");
  const pmTypeFilterOpts = useMemo(() => [
    { value: "", label: t("common.all") },
    ...pmTypeOptions,
  ], [t, pmTypeOptions]);

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
      await api.delete(`/equipment/pm-plans/${deleteTarget.id}`);
      fetchData();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<PmPlanRow>[]>(() => [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); panelAnimateRef.current = !isPanelOpen; setEditingPlan(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "planCode",
      header: t("equipment.pmPlan.planCode"),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "equip",
      header: t("equipment.pmPlan.equipCode"),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => {
        const equip = getValue() as PmPlanRow["equip"];
        return equip ? (
          <span className="font-mono text-xs">{equip.equipCode}</span>
        ) : "-";
      },
    },
    {
      id: "equipName",
      header: t("equipment.pmPlan.equipName"),
      size: 140,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.equip?.equipName ?? "-",
    },
    {
      accessorKey: "planName",
      header: t("equipment.pmPlan.planName"),
      size: 180,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "pmType",
      header: t("equipment.pmPlan.pmType"),
      size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PM_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "cycleType",
      header: t("equipment.pmPlan.cycleType"),
      size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PM_CYCLE_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "itemCount",
      header: t("equipment.pmPlan.itemsTitle"),
      size: 80,
      meta: { align: "center" as const, filterType: "number" as const },
      cell: ({ getValue }) => {
        const count = getValue() as number;
        return (
          <span className={`inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 rounded-full text-xs font-medium ${
            count > 0
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
              : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
          }`}>
            {count}
          </span>
        );
      },
    },
    {
      accessorKey: "nextDueAt",
      header: t("equipment.pmPlan.nextDueAt"),
      size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return "-";
        return new Date(v).toLocaleDateString();
      },
    },
    {
      accessorKey: "useYn",
      header: t("common.status"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const yn = getValue() as string;
        return (
          <span className={`w-2 h-2 rounded-full inline-block ${yn === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
        );
      },
    },
  ], [t, isPanelOpen]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center">
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
        <div className="grid grid-cols-4 gap-3">
          <StatCard label={t("common.total")} value={stats.totalPlans} icon={Wrench} color="blue" />
          <StatCard label={t("equipment.pmPlan.timeBased")} value={stats.timeBased} icon={Calendar} color="green" />
          <StatCard label={t("equipment.pmPlan.usageBased")} value={stats.usageBased} icon={Wrench} color="yellow" />
          <StatCard label={t("common.inactive")} value={stats.inactive} icon={Wrench} color="gray" />
        </div>

        {/* DataGrid */}
        <Card><CardContent>
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
                  <Select options={pmTypeFilterOpts} value={pmTypeFilter} onChange={setPmTypeFilter} fullWidth />
                </div>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={dueDateFrom}
                    onChange={(e) => setDueDateFrom(e.target.value)}
                    className="h-9 px-2 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-text"
                    title={t("equipment.pmPlan.dueDateFrom")}
                  />
                  <span className="text-text-muted text-xs">~</span>
                  <input
                    type="date"
                    value={dueDateTo}
                    onChange={(e) => setDueDateTo(e.target.value)}
                    className="h-9 px-2 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-text"
                    title={t("equipment.pmPlan.dueDateTo")}
                  />
                </div>
              </div>
            }
          />
        </CardContent></Card>
      </div>

      {/* Right Panel */}
      {isPanelOpen && (
        <PmPlanPanel
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
