"use client";

/**
 * @file src/app/(authenticated)/equipment/pm-result/page.tsx
 * @description PM 보전결과 페이지 - Work Order 실행 결과 목록 조회
 *
 * 초보자 가이드:
 * 1. PM 계획에서 생성된 Work Order의 실행 결과를 조회
 * 2. 상태: PLANNED(예정), IN_PROGRESS(진행중), COMPLETED(완료), CANCELLED(취소), OVERDUE(지연)
 * 3. API: GET /equipment/pm-work-orders
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Wrench, Search, RefreshCw,
  CheckCircle, AlertTriangle, Clock, Package,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import ComCodeSelect from "@/components/shared/ComCodeSelect";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface WoRow {
  workOrderNo: string;
  pmPlanCode: string;
  equipCode: string;
  woType: string;
  scheduledDate: string;
  dueDate: string;
  completedAt: string | null;
  status: string;
  priority: string;
  overallResult: string | null;
  remark: string | null;
  equip: { equipCode: string; equipName: string; lineCode: string | null; equipType: string | null } | null;
}

const statusColors: Record<string, string> = {
  PLANNED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  IN_PROGRESS: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  CANCELLED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export default function PmResultPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<WoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/equipment/pm-work-orders", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    completed: data.filter(d => d.status === "COMPLETED").length,
    planned: data.filter(d => d.status === "PLANNED" || d.status === "IN_PROGRESS").length,
    overdue: data.filter(d => d.status === "OVERDUE").length,
  }), [data]);

  const columns = useMemo<ColumnDef<WoRow>[]>(() => [
    {
      accessorKey: "workOrderNo", header: t("equipment.pmResult.woNo", "WO번호"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "scheduledDate", header: t("equipment.pmResult.scheduledDate", "예정일"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      id: "equipCode", header: t("equipment.pmResult.equipCode", "설비코드"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.equip?.equipCode || row.original.equipCode}</span>,
    },
    {
      id: "equipName", header: t("equipment.pmResult.equipName", "설비명"), size: 140,
      cell: ({ row }) => row.original.equip?.equipName || "-",
    },
    {
      accessorKey: "status", header: t("common.status"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        const labels: Record<string, string> = {
          PLANNED: t("equipment.pmResult.planned", "예정"),
          IN_PROGRESS: t("equipment.pmResult.inProgress", "진행중"),
          COMPLETED: t("equipment.pmResult.completed", "완료"),
          CANCELLED: t("equipment.pmResult.cancelled", "취소"),
          OVERDUE: t("equipment.pmResult.overdue", "지연"),
        };
        return <span className={`px-2 py-0.5 text-xs rounded font-medium ${statusColors[s] || ""}`}>{labels[s] || s}</span>;
      },
    },
    {
      accessorKey: "overallResult", header: t("equipment.pmResult.result", "결과"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const r = getValue() as string | null;
        if (!r) return <span className="text-xs text-text-muted">-</span>;
        return <span className={`px-2 py-0.5 text-xs rounded font-medium ${resultColors[r] || ""}`}>{r}</span>;
      },
    },
    {
      accessorKey: "priority", header: t("equipment.pmResult.priority", "우선순위"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const p = getValue() as string;
        const colors: Record<string, string> = {
          HIGH: "text-red-600 dark:text-red-400",
          MEDIUM: "text-yellow-600 dark:text-yellow-400",
          LOW: "text-text-muted",
        };
        return <span className={`text-xs font-medium ${colors[p] || ""}`}>{p}</span>;
      },
    },
    {
      accessorKey: "completedAt", header: t("equipment.pmResult.completedAt", "완료일"), size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <span className="text-xs">{v.split("T")[0]}</span> : "-";
      },
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Wrench className="w-7 h-7 text-primary" />{t("equipment.pmResult.title", "PM 보전결과")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.pmResult.subtitle", "예방보전 Work Order 실행 결과를 조회합니다.")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        <StatCard label={t("equipment.pmResult.statTotal", "전체 WO")} value={stats.total} icon={Package} color="blue" />
        <StatCard label={t("equipment.pmResult.completed", "완료")} value={stats.completed} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.pmResult.planned", "예정/진행")} value={stats.planned} icon={Clock} color="yellow" />
        <StatCard label={t("equipment.pmResult.overdue", "지연")} value={stats.overdue} icon={AlertTriangle} color="red" />
      </div>

      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.pmResult.title", "PM보전결과")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("equipment.pmResult.searchPlaceholder", "WO번호, 설비코드 검색...")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <ComCodeSelect groupCode="PM_WO_STATUS" labelPrefix={t("common.status")}
                  value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
