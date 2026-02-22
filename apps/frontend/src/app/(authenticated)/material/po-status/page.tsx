"use client";

/**
 * @file src/app/(authenticated)/material/po-status/page.tsx
 * @description PO현황 페이지 - 구매발주 현황 조회 전용
 *
 * 초보자 가이드:
 * 1. **조회 전용**: CRUD 없이 DataGrid + 필터만 제공
 * 2. **입고율**: 발주 수량 대비 입고 수량 비율 표시
 * 3. API: GET /material/po-status
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Search, RefreshCw, ShoppingCart, CheckCircle, Clock, Package } from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface PoStatusItem {
  id: string;
  poNo: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalOrderQty: number;
  totalReceivedQty: number;
  receiveRate: number;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  PARTIAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  RECEIVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CLOSED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function PoStatusPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<PoStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/material/po-status", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "DRAFT", label: "DRAFT" },
    { value: "CONFIRMED", label: "CONFIRMED" },
    { value: "PARTIAL", label: "PARTIAL" },
    { value: "RECEIVED", label: "RECEIVED" },
    { value: "CLOSED", label: "CLOSED" },
  ], [t]);

  const stats = useMemo(() => ({
    total: data.length,
    confirmed: data.filter(d => d.status === "CONFIRMED").length,
    partial: data.filter(d => d.status === "PARTIAL").length,
    received: data.filter(d => d.status === "RECEIVED").length,
  }), [data]);

  const columns = useMemo<ColumnDef<PoStatusItem>[]>(() => [
    {
      accessorKey: "poNo", header: "PO No.", size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "partnerName", header: t("material.po.partnerName"), size: 120,
      meta: { filterType: "text" as const },
    },
    { accessorKey: "orderDate", header: t("material.po.orderDate"), size: 110 },
    { accessorKey: "dueDate", header: t("material.po.dueDate"), size: 110 },
    {
      accessorKey: "totalOrderQty", header: t("material.poStatus.orderQty"), size: 100,
      meta: { align: "right" as const },
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "totalReceivedQty", header: t("material.poStatus.receivedQty"), size: 100,
      meta: { align: "right" as const },
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "receiveRate", header: t("material.poStatus.receiveRate"), size: 120,
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 100,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />{t("material.poStatus.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.poStatus.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("material.poStatus.stats.total")} value={stats.total} icon={ShoppingCart} color="blue" />
        <StatCard label={t("material.poStatus.stats.confirmed")} value={stats.confirmed} icon={Clock} color="yellow" />
        <StatCard label={t("material.poStatus.stats.partial")} value={stats.partial} icon={Package} color="orange" />
        <StatCard label={t("material.poStatus.stats.received")} value={stats.received} icon={CheckCircle} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("material.poStatus.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.poStatus.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>
    </div>
  );
}
