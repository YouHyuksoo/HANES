"use client";

/**
 * @file src/app/(authenticated)/material/po-status/page.tsx
 * @description PO현황 페이지 - 좌측 마스터(PO목록) + 우측 디테일(품목 입고현황)
 *
 * 초보자 가이드:
 * 1. **좌측 패널**: PO 목록 (마스터) - 클릭 시 우측에 해당 PO의 품목 입고현황 표시
 * 2. **우측 패널**: 선택된 PO의 품목별 입고율 (디테일)
 * 3. API: GET /material/po-status
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList, Search, RefreshCw, ShoppingCart,
  CheckCircle, Clock, Package, Truck,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface PoStatusItemRaw {
  id: number;
  poNo: string;
  itemCode: string;
  itemName: string;
  spec: string | null;
  unit: string | null;
  orderQty: number;
  receivedQty: number;
  receiveRate: number;
}

interface PoStatusRaw {
  poNo: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalOrderQty: number;
  totalReceivedQty: number;
  receiveRate: number;
  items: PoStatusItemRaw[];
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

  const [data, setData] = useState<PoStatusRaw[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedPo, setSelectedPo] = useState<PoStatusRaw | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/material/po-status", { params });
      const list = res.data?.data ?? [];
      setData(list);
      if (selectedPo) {
        const updated = list.find((p: PoStatusRaw) => p.poNo === selectedPo.poNo);
        setSelectedPo(updated ?? list[0] ?? null);
      } else if (list.length > 0) {
        setSelectedPo(list[0]);
      }
    } catch {
      setData([]);
      setSelectedPo(null);
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.status") },
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

  /** 마스터 그리드 컬럼 */
  const masterColumns = useMemo<ColumnDef<PoStatusRaw>[]>(() => [
    {
      accessorKey: "poNo", header: "PO No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "partnerName", header: t("material.po.partnerName"), size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "orderDate", header: t("material.po.orderDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      accessorKey: "receiveRate", header: t("material.poStatus.receiveRate"), size: 130,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full"
                style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>
            {s}
          </span>
        );
      },
    },
  ], [t]);

  /** 디테일 그리드 컬럼 (품목별 입고현황) */
  const detailColumns = useMemo<ColumnDef<PoStatusItemRaw>[]>(() => [
    {
      accessorKey: "itemCode", header: t("material.poStatus.itemCode"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "itemName", header: t("material.poStatus.itemName"), size: 180,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "spec", header: t("material.poStatus.spec"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "unit", header: t("material.poStatus.unit"), size: 60,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "orderQty", header: t("material.poStatus.orderQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "receivedQty", header: t("material.poStatus.receivedQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "receiveRate", header: t("material.poStatus.receiveRate"), size: 130,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${rate >= 100 ? "bg-green-500" : rate > 0 ? "bg-yellow-500" : "bg-gray-400"}`}
                style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
  ], [t]);

  const detailItems = selectedPo?.items ?? [];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("material.poStatus.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.poStatus.subtitle")}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          {t("common.refresh")}
        </Button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("material.poStatus.stats.total")} value={stats.total}
          icon={ShoppingCart} color="blue" />
        <StatCard label={t("material.poStatus.stats.confirmed")} value={stats.confirmed}
          icon={Clock} color="yellow" />
        <StatCard label={t("material.poStatus.stats.partial")} value={stats.partial}
          icon={Truck} color="orange" />
        <StatCard label={t("material.poStatus.stats.received")} value={stats.received}
          icon={CheckCircle} color="green" />
      </div>

      {/* 마스터-디테일 좌우 분할 */}
      <div className="grid grid-cols-12 gap-4">
        {/* 좌측: PO 마스터 */}
        <div className="col-span-7">
          <Card><CardContent>
            <DataGrid data={data} columns={masterColumns} isLoading={loading}
              enableColumnFilter enableExport
              exportFileName={t("material.poStatus.title")}
              onRowClick={(row) => setSelectedPo(row)}
              selectedRowId={selectedPo?.poNo}
              getRowId={(row) => row.poNo}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("material.poStatus.searchPlaceholder")}
                      value={searchText} onChange={e => setSearchText(e.target.value)}
                      leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                  <div className="w-36 flex-shrink-0">
                    <Select options={statusOptions}
                      value={statusFilter} onChange={setStatusFilter} fullWidth />
                  </div>
                </div>
              } />
          </CardContent></Card>
        </div>

        {/* 우측: 품목 입고현황 디테일 */}
        <div className="col-span-5">
          <Card>
            <CardContent>
              {selectedPo ? (
                <div className="space-y-3">
                  {/* 선택된 PO 헤더 정보 */}
                  <div className="p-3 rounded-lg bg-surface-secondary dark:bg-slate-800/50 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-primary text-lg">
                        {selectedPo.poNo}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[selectedPo.status] || ""}`}>
                        {selectedPo.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <div>
                        <span className="text-text-muted">{t("material.po.partnerName")}:</span>{" "}
                        <span className="font-medium">{selectedPo.partnerName}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">{t("material.poStatus.receiveRate")}:</span>{" "}
                        <span className={`font-bold ${selectedPo.receiveRate >= 100 ? "text-green-600" : "text-yellow-600"}`}>
                          {selectedPo.receiveRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-text-muted">{t("material.po.orderDate")}:</span>{" "}
                        {selectedPo.orderDate}
                      </div>
                      <div>
                        <span className="text-text-muted">{t("material.po.dueDate")}:</span>{" "}
                        {selectedPo.dueDate}
                      </div>
                    </div>
                  </div>

                  {/* 품목별 입고현황 */}
                  <DataGrid data={detailItems} columns={detailColumns}
                    enableColumnFilter={false}
                    enableExport exportFileName={`${selectedPo.poNo}_status`} />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                  <Package className="w-12 h-12 mb-3 opacity-40" />
                  <p className="text-sm">PO를 선택하면 품목 입고현황이 표시됩니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
