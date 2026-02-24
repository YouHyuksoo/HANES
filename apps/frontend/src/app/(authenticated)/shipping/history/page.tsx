"use client";

/**
 * @file src/app/(authenticated)/shipping/history/page.tsx
 * @description 출하이력조회 페이지 - 출하 이력 필터링 조회 (조회 전용)
 *
 * 초보자 가이드:
 * 1. **조회 전용**: 출하지시 이력을 다양한 필터로 검색
 * 2. **필터**: 상태, 날짜 범위, 고객명 등으로 필터링
 * 3. API: GET /shipping/ship-orders (조회 전용)
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  History, Search, RefreshCw,
  FileText, CheckCircle, Truck, Archive,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import api from "@/services/api";

interface ShipHistory {
  id: string;
  shipOrderNo: string;
  customerName: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
  createdAt: string;
}

export default function ShipHistoryPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ShipHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const comCodeStatusOptions = useComCodeOptions("SHIP_ORDER_STATUS");
  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") }, ...comCodeStatusOptions
  ], [t, comCodeStatusOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.shipDateFrom = dateFrom;
      if (dateTo) params.shipDateTo = dateTo;
      const res = await api.get("/shipping/ship-orders", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = useMemo(() => ({
    total: data.length,
    shipped: data.filter((d) => d.status === "SHIPPED").length,
    confirmed: data.filter((d) => d.status === "CONFIRMED").length,
    totalQty: data.reduce((sum, d) => sum + d.totalQty, 0),
  }), [data]);

  const columns = useMemo<ColumnDef<ShipHistory>[]>(() => [
    { accessorKey: "shipOrderNo", header: t("shipping.history.shipOrderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.history.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "dueDate", header: t("shipping.history.dueDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "shipDate", header: t("shipping.history.shipDateCol"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "itemCount", header: t("shipping.history.itemCount"), size: 70, meta: { filterType: "number" as const } },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 100, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 90, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="SHIP_ORDER_STATUS" code={getValue() as string} /> },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 100, meta: { filterType: "date" as const } },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><History className="w-7 h-7 text-primary" />{t("shipping.history.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.history.subtitle")}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.history.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.history.statusShipped")} value={stats.shipped} icon={Truck} color="green" />
        <StatCard label={t("shipping.history.statConfirmedWait")} value={stats.confirmed} icon={CheckCircle} color="yellow" />
        <StatCard label={t("shipping.history.statTotalQty")} value={stats.totalQty.toLocaleString()} icon={Archive} color="purple" />
      </div>
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("shipping.history.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("shipping.history.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
