"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  Timer, Search, RefreshCw, AlertTriangle, CheckCircle,
  XCircle, Clock, FlaskConical,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ShelfLifeItem {
  matUid: string;
  itemCode?: string;
  itemName?: string;
  currentQty: number;
  unit?: string;
  expireDate?: string;
  expiryStatus: string;
  daysUntilExpiry: number | null;
  vendor?: string;
  status?: string;
}

const expiryColors: Record<string, string> = {
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
  NEAR_EXPIRY: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
  VALID: "text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700",
  DISCARDED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function ShelfLifePage() {
  const { t } = useTranslation();
  const router = useRouter();

  const [data, setData] = useState<ShelfLifeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (expiryFilter) params.expiryStatus = expiryFilter;
      const res = await api.get("/material/shelf-life", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, expiryFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const expiryOptions = useMemo(() => [
    { value: "", label: t("common.status") },
    { value: "EXPIRED", label: t("material.shelfLife.expired") },
    { value: "NEAR_EXPIRY", label: t("material.shelfLife.nearExpiry") },
    { value: "VALID", label: t("material.shelfLife.valid") },
    { value: "DISCARDED", label: t("material.shelfLife.discarded") },
  ], [t]);

  const stats = useMemo(() => ({
    total: data.filter(d => d.expiryStatus !== "DISCARDED").length,
    expired: data.filter(d => d.expiryStatus === "EXPIRED").length,
    nearExpiry: data.filter(d => d.expiryStatus === "NEAR_EXPIRY").length,
    valid: data.filter(d => d.expiryStatus === "VALID").length,
    discarded: data.filter(d => d.expiryStatus === "DISCARDED").length,
  }), [data]);

  const rowClassName = useCallback((row: ShelfLifeItem) => {
    if (row.expiryStatus === "DISCARDED") return "!bg-gray-50/50 dark:!bg-gray-900/20 opacity-60";
    if (row.expiryStatus === "EXPIRED") return "!bg-red-50/50 dark:!bg-red-950/20";
    if (row.expiryStatus === "NEAR_EXPIRY") return "!bg-yellow-50/50 dark:!bg-yellow-950/20";
    return "";
  }, []);

  const columns = useMemo<ColumnDef<ShelfLifeItem>[]>(() => [
    {
      accessorKey: "matUid", header: "LOT No.", size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "currentQty", header: t("material.shelfLife.currentQty"), size: 110,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{(row.original.currentQty ?? 0).toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "vendor", header: t("material.shelfLife.vendor"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "expireDate", header: t("material.shelfLife.expireDate"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : "-";
      },
    },
    {
      accessorKey: "daysUntilExpiry", header: t("material.shelfLife.remainDays"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row, getValue }) => {
        if (row.original.expiryStatus === "DISCARDED") return <span className="text-text-muted">-</span>;
        const days = getValue() as number | null;
        if (days === null) return <span className="text-text-muted">-</span>;
        const cls = days < 0 ? "text-red-600 dark:text-red-400" : days <= 10 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400";
        return <span className={`font-medium ${cls}`}>{days}{t("material.shelfLife.days")}</span>;
      },
    },
    {
      accessorKey: "expiryStatus", header: t("common.status"), size: 100, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const label = getValue() as string;
        const displayName = label === "EXPIRED" ? t("material.shelfLife.expired")
          : label === "NEAR_EXPIRY" ? t("material.shelfLife.nearExpiry")
          : label === "DISCARDED" ? t("material.shelfLife.discarded")
          : t("material.shelfLife.valid");
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${expiryColors[label] || ""}`}>{displayName}</span>;
      },
    },
    {
      id: "actions", header: "", size: 80, enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        const canReinspect = item.expiryStatus === "EXPIRED" || item.expiryStatus === "NEAR_EXPIRY";
        if (!canReinspect) return null;
        return (
          <Button size="sm" variant="secondary" className="h-6 px-2 text-xs"
            onClick={() => router.push(`/material/shelf-life-reinspect?matUid=${item.matUid}`)}>
            <FlaskConical className="w-3 h-3 mr-1" />{t("material.shelfLife.reinspect")}
          </Button>
        );
      },
    },
  ], [t, router]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <Timer className="w-7 h-7 text-primary" />{t("material.shelfLife.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.shelfLife.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-3 flex-shrink-0">
        <StatCard label={t("material.shelfLife.stats.total")} value={stats.total} icon={Clock} color="blue" />
        <StatCard label={t("material.shelfLife.stats.expired")} value={stats.expired} icon={XCircle} color="red" />
        <StatCard label={t("material.shelfLife.stats.nearExpiry")} value={stats.nearExpiry} icon={AlertTriangle} color="yellow" />
        <StatCard label={t("material.shelfLife.stats.valid")} value={stats.valid} icon={CheckCircle} color="green" />
        <StatCard label={t("material.shelfLife.stats.discarded")} value={stats.discarded} icon={XCircle} color="gray" />
      </div>

      {/* 데이터 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none">
        <CardContent className="h-full p-4">
          <DataGrid data={data} columns={columns} isLoading={loading}
            enableColumnFilter enableExport exportFileName={t("material.shelfLife.title")}
            rowClassName={rowClassName}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("material.shelfLife.searchPlaceholder")}
                    value={searchText} onChange={e => setSearchText(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={expiryOptions} value={expiryFilter} onChange={setExpiryFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
