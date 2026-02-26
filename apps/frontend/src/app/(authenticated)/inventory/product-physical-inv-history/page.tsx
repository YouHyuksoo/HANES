"use client";

/**
 * @file src/app/(authenticated)/inventory/product-physical-inv-history/page.tsx
 * @description 제품 재고실사 이력 조회 - InvAdjLog(adjType=PRODUCT_PHYSICAL_COUNT) 조회
 *
 * 초보자 가이드:
 * 1. 창고, 일자범위, 검색어 필터링
 * 2. 장부수량 vs 실사수량 차이표시 (양수=파란, 음수=빨간, 0=초록)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardCheck, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { useWarehouseOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface InvHistoryItem {
  id: string;
  warehouseCode: string;
  warehouseName?: string;
  itemCode: string;
  itemName?: string;
  unit?: string;
  lotId?: string;
  lotNo?: string;
  beforeQty: number;
  afterQty: number;
  diffQty: number;
  reason?: string;
  createdBy?: string;
  createdAt: string;
}

export default function ProductPhysicalInvHistoryPage() {
  const { t } = useTranslation();
  const { options: warehouseOpts } = useWarehouseOptions();

  const [data, setData] = useState<InvHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (warehouseFilter) params.warehouseCode = warehouseFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await api.get("/inventory/product-physical-inv/history", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, warehouseFilter, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const warehouseOptions = useMemo(() => [
    { value: "", label: t("common.all") }, ...warehouseOpts,
  ], [t, warehouseOpts]);

  const stats = useMemo(() => ({
    total: data.length,
    positive: data.filter(d => d.diffQty > 0).length,
    negative: data.filter(d => d.diffQty < 0).length,
    matched: data.filter(d => d.diffQty === 0).length,
  }), [data]);

  const columns = useMemo<ColumnDef<InvHistoryItem>[]>(() => [
    {
      accessorKey: "createdAt", header: t("inventory.productPhysicalInvHistory.countDate"), size: 140,
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "warehouseName", header: t("inventory.productPhysicalInvHistory.warehouse"), size: 110,
      meta: { filterType: "text" as const },
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
      accessorKey: "lotNo", header: "LOT No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "beforeQty", header: t("inventory.productPhysicalInvHistory.systemQty"), size: 100,
      cell: ({ getValue, row }) => (
        <span>{(getValue() as number).toLocaleString()} {row.original.unit || ""}</span>
      ),
      meta: { align: "right" as const },
    },
    {
      accessorKey: "afterQty", header: t("inventory.productPhysicalInvHistory.countedQty"), size: 100,
      cell: ({ getValue, row }) => (
        <span className="font-medium">{(getValue() as number).toLocaleString()} {row.original.unit || ""}</span>
      ),
      meta: { align: "right" as const },
    },
    {
      accessorKey: "diffQty", header: t("inventory.productPhysicalInvHistory.diffQty"), size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (v === 0) return <span className="text-green-600 dark:text-green-400">0</span>;
        const cls = v > 0
          ? "text-blue-600 dark:text-blue-400 font-medium"
          : "text-red-600 dark:text-red-400 font-medium";
        return <span className={cls}>{v > 0 ? "+" : ""}{v.toLocaleString()}</span>;
      },
      meta: { align: "right" as const },
    },
    {
      accessorKey: "reason", header: t("inventory.productPhysicalInvHistory.reason"), size: 120,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "createdBy", header: t("inventory.productPhysicalInvHistory.inspector"), size: 90,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ], [t]);

  const rowClassName = useCallback((row: InvHistoryItem) => {
    if (row.diffQty > 0) return "!bg-blue-50/50 dark:!bg-blue-950/20";
    if (row.diffQty < 0) return "!bg-red-50/50 dark:!bg-red-950/20";
    return "";
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />
            {t("inventory.productPhysicalInvHistory.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("inventory.productPhysicalInvHistory.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("inventory.productPhysicalInvHistory.stats.total")} value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label={t("inventory.productPhysicalInvHistory.stats.positive")} value={stats.positive} icon={ClipboardCheck} color="purple" />
        <StatCard label={t("inventory.productPhysicalInvHistory.stats.negative")} value={stats.negative} icon={ClipboardCheck} color="red" />
        <StatCard label={t("inventory.productPhysicalInvHistory.stats.matched")} value={stats.matched} icon={ClipboardCheck} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter rowClassName={rowClassName} enableExport exportFileName={t("inventory.productPhysicalInvHistory.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("inventory.productPhysicalInvHistory.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select options={warehouseOptions} value={warehouseFilter} onChange={setWarehouseFilter} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Input type="date"
                  value={startDate} onChange={e => setStartDate(e.target.value)} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Input type="date"
                  value={endDate} onChange={e => setEndDate(e.target.value)} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
