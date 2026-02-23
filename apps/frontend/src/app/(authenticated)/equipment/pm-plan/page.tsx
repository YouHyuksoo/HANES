"use client";

/**
 * @file src/app/(authenticated)/equipment/pm-plan/page.tsx
 * @description PM(예방보전) 계획 마스터 페이지 - 설비별 보전항목/주기/부품 관리
 *
 * 초보자 가이드:
 * 1. **DataGrid**: PM 계획 목록 (코드, 설비, 주기, 다음예정일 등)
 * 2. **필터**: PM유형, 검색어
 * 3. **CRUD**: 등록/수정/삭제 모달
 * 4. API: GET/POST/PUT/DELETE /equipment/pm-plans
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Wrench, Plus, RefreshCw, Search, Calendar,
} from "lucide-react";
import {
  Button, Input, Select, StatCard,
  ConfirmModal, ComCodeBadge,
} from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { useEquipOptions } from "@/hooks/useMasterOptions";
import PmPlanModal from "./components/PmPlanModal";
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
  estimatedTime: number | null;
  nextDueAt: string | null;
  useYn: string;
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
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [pmTypeFilter, setPmTypeFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PmPlanRow | null>(null);

  const pmTypeOptions = useComCodeOptions("PM_TYPE");
  const pmTypeFilterOpts = useMemo(() => [
    { value: "", label: t("common.all") },
    ...pmTypeOptions,
  ], [t, pmTypeOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 50 };
      if (search) params.search = search;
      if (pmTypeFilter) params.pmType = pmTypeFilter;
      const res = await api.get("/equipment/pm-plans", { params });
      setData(res.data?.data ?? []);
      setTotal(res.data?.meta?.total ?? 0);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, pmTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => {
    const totalPlans = data.length;
    const timeBased = data.filter((d) => d.pmType === "TIME_BASED").length;
    const usageBased = data.filter((d) => d.pmType === "USAGE_BASED").length;
    const inactive = data.filter((d) => d.useYn === "N").length;
    return { totalPlans, timeBased, usageBased, inactive };
  }, [data]);

  const handleEdit = useCallback((row: PmPlanRow) => {
    setEditId(row.id);
    setModalOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/equipment/pm-plans/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<PmPlanRow>[]>(() => [
    {
      accessorKey: "planCode",
      header: t("equipment.pmPlan.planCode"),
      size: 120,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "equip",
      header: t("equipment.pmPlan.equipCode"),
      size: 120,
      cell: ({ getValue }) => {
        const equip = getValue() as PmPlanRow["equip"];
        return equip ? (
          <span className="font-mono text-xs">{equip.equipCode}</span>
        ) : "-";
      },
    },
    {
      accessorKey: "planName",
      header: t("equipment.pmPlan.planName"),
      size: 180,
    },
    {
      accessorKey: "pmType",
      header: t("equipment.pmPlan.pmType"),
      size: 100,
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PM_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "cycleType",
      header: t("equipment.pmPlan.cycleType"),
      size: 100,
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PM_CYCLE_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "nextDueAt",
      header: t("equipment.pmPlan.nextDueAt"),
      size: 120,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        if (!v) return "-";
        const d = new Date(v);
        return d.toLocaleDateString();
      },
    },
    {
      accessorKey: "useYn",
      header: t("common.status"),
      size: 80,
      cell: ({ getValue }) => {
        const yn = getValue() as string;
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            yn === "Y"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
          }`}>
            {yn === "Y" ? t("common.active") : t("common.inactive")}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: t("common.actions"),
      size: 100,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(row.original)}>
            {t("common.edit")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteTarget(row.original)}
            className="text-red-500 hover:text-red-700"
          >
            {t("common.delete")}
          </Button>
        </div>
      ),
    },
  ], [t, handleEdit]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Wrench className="w-7 h-7 text-primary" />
            {t("equipment.pmPlan.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.pmPlan.description")}</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-surface text-text focus:outline-none focus:ring-1 focus:ring-primary w-44"
            />
          </div>
          <div className="w-32">
            <Select options={pmTypeFilterOpts} value={pmTypeFilter} onChange={setPmTypeFilter} fullWidth />
          </div>
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => { setEditId(null); setModalOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />
            {t("equipment.pmPlan.addPlan")}
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
      <DataGrid
        data={data}
        columns={columns}
        isLoading={loading}
        enableColumnFilter
        enableExport
        exportFileName={t("equipment.pmPlan.title")}
      />

      {/* Modal */}
      <PmPlanModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditId(null); }}
        editId={editId}
        onSaved={fetchData}
      />

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("equipment.pmPlan.deletePlan")}
        message={`${deleteTarget?.planCode} - ${deleteTarget?.planName}\n${t("equipment.pmPlan.deleteConfirm")}`}
        confirmText={t("common.delete")}
        variant="danger"
      />
    </div>
  );
}
