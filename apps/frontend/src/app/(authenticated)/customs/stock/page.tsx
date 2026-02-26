"use client";

/**
 * @file src/app/(authenticated)/customs/stock/page.tsx
 * @description 보세 자재 재고 현황 페이지
 *
 * 초보자 가이드:
 * 1. **보세 재고**: 수입신고 LOT별 보세 자재 재고 현황
 * 2. **상태**: BONDED(보세중), PARTIAL(일부사용), RELEASED(반출완료)
 * 3. API: GET /customs/stock
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Search, Package } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface CustomsLot {
  id: string;
  entryNo: string;
  lotNo: string;
  itemCode: string;
  itemName: string;
  origin: string;
  qty: number;
  usedQty: number;
  remainQty: number;
  status: string;
  declarationDate: string;
}

const statusColors: Record<string, string> = {
  BONDED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PARTIAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  RELEASED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

export default function CustomsStockPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomsLot[]>([]);
  const [loading, setLoading] = useState(false);

  const statusLabels: Record<string, string> = useMemo(() => ({
    BONDED: t("customs.stock.statusBonded"),
    PARTIAL: t("customs.stock.statusPartial"),
    RELEASED: t("customs.stock.statusReleased"),
  }), [t]);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/customs/stock", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = useMemo<ColumnDef<CustomsLot>[]>(() => [
    { accessorKey: "entryNo", header: t("customs.entry.entryNo"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "lotNo", header: t("customs.stock.lotNo"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "origin", header: t("customs.entry.origin"), size: 70, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("customs.stock.receivedQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    { accessorKey: "usedQty", header: t("customs.stock.usedQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => (getValue() as number).toLocaleString() },
    {
      accessorKey: "remainQty", header: t("customs.stock.remainQty"), size: 90, meta: { filterType: "number" as const },
      cell: ({ getValue }) => { const val = getValue() as number; return <span className={val === 0 ? "text-text-muted" : "font-semibold text-primary"}>{val.toLocaleString()}</span>; },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => { const status = getValue() as string; return <span className={`px-2 py-1 text-xs rounded-full ${statusColors[status]}`}>{statusLabels[status]}</span>; },
    },
    { accessorKey: "declarationDate", header: t("customs.entry.declarationDate"), size: 100, meta: { filterType: "date" as const } },
  ], [t, statusLabels]);

  const stats = useMemo(() => {
    const bondedLots = data.filter((d) => d.status !== "RELEASED");
    const totalRemain = bondedLots.reduce((sum, d) => sum + d.remainQty, 0);
    return { totalLots: data.length, bondedLots: bondedLots.length, totalRemain };
  }, [data]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Package className="w-7 h-7 text-primary" />{t("customs.stock.title")}</h1>
          <p className="text-text-muted mt-1">{t("customs.stock.description")}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label={t("customs.stock.totalLots")} value={stats.totalLots} icon={Package} color="blue" />
        <StatCard label={t("customs.stock.bondedLots")} value={stats.bondedLots} icon={Package} color="purple" />
        <StatCard label={t("customs.stock.totalRemain")} value={stats.totalRemain.toLocaleString()} icon={Package} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("customs.stock.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("customs.stock.searchPlaceholder")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Select options={[{ value: "", label: t("common.allStatus") }, { value: "BONDED", label: t("customs.stock.statusBonded") }, { value: "PARTIAL", label: t("customs.stock.statusPartial") }, { value: "RELEASED", label: t("customs.stock.statusReleased") }]} value={statusFilter} onChange={setStatusFilter} placeholder={t("common.status")} />
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          }
        />
      </CardContent></Card>
    </div>
  );
}
