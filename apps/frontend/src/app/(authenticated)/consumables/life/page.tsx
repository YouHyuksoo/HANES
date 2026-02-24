"use client";

/**
 * @file src/app/(authenticated)/consumables/life/page.tsx
 * @description 소모품 수명 현황 페이지 - 컴팩트 테이블 디자인
 *
 * 초보자 가이드:
 * 1. **수명 관리**: 소모품(금형, 지그, 공구)의 사용횟수 기반 수명 모니터링
 * 2. **상태**: NORMAL(정상), WARNING(주의), REPLACE(교체필요)
 * 3. API: GET /consumables/life-status
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, RotateCcw, Activity, Search } from "lucide-react";
import { Card, Button, ComCodeBadge, Input, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface LifeStatus {
  id: string;
  consumableCode: string;
  name: string;
  category: string;
  currentCount: number;
  expectedLife: number;
  warningCount: number;
  lifePercentage: number;
  remainingLife: number;
  status: "NORMAL" | "WARNING" | "REPLACE";
  lastReplaced: string | null;
  location: string;
}

export default function ConsumableLifePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<LifeStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await api.get("/consumables/life-status", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter, categoryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    normal: data.filter((d) => d.status === "NORMAL").length,
    warning: data.filter((d) => d.status === "WARNING").length,
    replace: data.filter((d) => d.status === "REPLACE").length,
  }), [data]);

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return "bg-red-500";
    if (pct >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "REPLACE":
        return <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">{t("consumables.life.replace")}</span>;
      case "WARNING":
        return <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">{t("consumables.life.warning")}</span>;
      default:
        return <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">{t("consumables.life.normal")}</span>;
    }
  };

  const columns = useMemo<ColumnDef<LifeStatus>[]>(() => [
    { accessorKey: "status", header: t("common.status"), size: 60, meta: { filterType: "multi" as const }, cell: ({ getValue }) => getStatusBadge(getValue() as string) },
    { accessorKey: "consumableCode", header: t("consumables.master.code"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "name", header: t("consumables.master.name"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "category", header: t("consumables.life.categoryLabel"), size: 70, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} /> },
    { accessorKey: "location", header: t("consumables.life.location"), size: 110, meta: { filterType: "text" as const } },
    {
      accessorKey: "lifePercentage", header: t("consumables.life.lifeLabel"), size: 100, meta: { filterType: "number" as const },
      cell: ({ row }) => {
        const pct = row.original.lifePercentage;
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full ${getProgressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className={`text-xs ${pct >= 100 ? "text-red-600" : pct >= 80 ? "text-yellow-600" : "text-text-muted"}`}>{pct}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "currentCount", header: t("consumables.life.currentExpected"), size: 110, meta: { filterType: "number" as const },
      cell: ({ row }) => <span className="text-xs">{row.original.currentCount.toLocaleString()} / {row.original.expectedLife.toLocaleString()}</span>,
    },
    {
      accessorKey: "remainingLife", header: t("consumables.life.remaining"), size: 70, meta: { filterType: "number" as const },
      cell: ({ getValue }) => {
        const val = getValue() as number;
        return <span className={`text-xs ${val < 0 ? "text-red-600 font-medium" : "text-text-muted"}`}>{val < 0 ? `+${Math.abs(val).toLocaleString()}` : val.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "lastReplaced", header: t("consumables.life.lastReplaced"), size: 90, meta: { filterType: "date" as const },
      cell: ({ getValue }) => getValue() ? <span className="text-xs text-text-muted">{getValue() as string}</span> : "-",
    },
    {
      id: "actions", header: t("common.manage"), size: 70, meta: { filterType: "none" as const },
      cell: ({ row }) => row.original.status === "REPLACE" ? (
        <Button size="sm" variant="secondary"><RotateCcw className="w-3 h-3 mr-1" /> {t("consumables.life.replaceAction")}</Button>
      ) : null,
    },
  ], [t]);

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-text">{t("consumables.life.title")}</h1>
          <span className="text-xs text-text-muted">{data.length}{t("common.count")}</span>
        </div>
      </div>

      <div className="flex gap-2 text-xs">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
          <Activity className="w-3 h-3" /> {t("common.total")} {stats.total}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded">
          <CheckCircle className="w-3 h-3" /> {t("consumables.life.normal")} {stats.normal}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 rounded">
          <AlertTriangle className="w-3 h-3" /> {t("consumables.life.warning")} {stats.warning}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded">
          <XCircle className="w-3 h-3" /> {t("consumables.life.replace")} {stats.replace}
        </span>
      </div>

      <Card className="overflow-hidden p-4">
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("consumables.life.title")}
          toolbarLeft={
            <div className="flex gap-2 items-center flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("consumables.life.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-3.5 h-3.5" />} fullWidth />
              </div>
              <div className="w-28 flex-shrink-0">
                <Select options={[{ value: "", label: t("common.allStatus") }, { value: "NORMAL", label: t("consumables.life.normal") }, { value: "WARNING", label: t("consumables.life.warning") }, { value: "REPLACE", label: t("consumables.life.replace") }]} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <div className="w-28 flex-shrink-0">
                <Select options={[{ value: "", label: t("common.all") }, { value: "MOLD", label: t("comCode.CONSUMABLE_CATEGORY.MOLD") }, { value: "JIG", label: t("comCode.CONSUMABLE_CATEGORY.JIG") }, { value: "TOOL", label: t("comCode.CONSUMABLE_CATEGORY.TOOL") }]} value={categoryFilter} onChange={setCategoryFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </Card>
    </div>
  );
}
