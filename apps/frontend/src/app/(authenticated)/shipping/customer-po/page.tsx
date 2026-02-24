"use client";

/**
 * @file src/app/(authenticated)/shipping/customer-po/page.tsx
 * @description 고객발주관리 페이지 - 고객 수주 CRUD (우측 패널 방식)
 *
 * 초보자 가이드:
 * 1. **고객발주**: 고객이 우리 회사에 발주한 주문서 관리
 * 2. **상태 흐름**: RECEIVED -> CONFIRMED -> IN_PRODUCTION -> PARTIAL_SHIP -> SHIPPED -> CLOSED
 * 3. **우측 패널**: 추가/수정 폼은 우측 슬라이드 패널에서 처리
 * 4. API: GET/POST/PUT/DELETE /shipping/customer-orders
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ShoppingCart, Plus, Search, RefreshCw, Edit2, Trash2,
  FileText, Clock, CheckCircle, Factory, Truck,
} from "lucide-react";
import { Card, CardContent, Button, Input, Select, StatCard, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import CustomerPoFormPanel, { type CustomerOrder } from "./components/CustomerPoFormPanel";
import api from "@/services/api";

const statusColors: Record<string, string> = {
  RECEIVED: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  IN_PRODUCTION: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  PARTIAL_SHIP: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  SHIPPED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  CLOSED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function CustomerPoPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomerOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerOrder | null>(null);
  const panelAnimateRef = useRef(true);

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") },
    { value: "RECEIVED", label: t("shipping.customerPo.statusReceived") },
    { value: "CONFIRMED", label: t("shipping.customerPo.statusConfirmed") },
    { value: "IN_PRODUCTION", label: t("shipping.customerPo.statusInProduction") },
    { value: "SHIPPED", label: t("shipping.customerPo.statusShipped") },
    { value: "CLOSED", label: t("shipping.customerPo.statusClosed") },
  ], [t]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/customer-orders", { params });
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
    received: data.filter((d) => d.status === "RECEIVED").length,
    confirmed: data.filter((d) => d.status === "CONFIRMED").length,
    inProduction: data.filter((d) => d.status === "IN_PRODUCTION").length,
    shipped: data.filter((d) => d.status === "SHIPPED" || d.status === "CLOSED").length,
  }), [data]);

  const handlePanelClose = useCallback(() => {
    setIsPanelOpen(false);
    setEditingItem(null);
    panelAnimateRef.current = true;
  }, []);

  const handlePanelSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/shipping/customer-orders/${deleteTarget.id}`);
      fetchData();
    } catch {
      // 에러는 api 인터셉터에서 처리
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<CustomerOrder>[]>(() => [
    {
      id: "actions", header: "", size: 80,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); panelAnimateRef.current = !isPanelOpen; setEditingItem(row.original); setIsPanelOpen(true); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "orderNo", header: t("shipping.customerPo.orderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.customerPo.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "orderDate", header: t("shipping.customerPo.orderDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "dueDate", header: t("shipping.customerPo.dueDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "itemCount", header: t("shipping.customerPo.itemCount"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalAmount", header: t("shipping.customerPo.totalAmount"), size: 120, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    {
      accessorKey: "status", header: t("common.status"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        const label = statusOptions.find((o) => o.value === s)?.label || s;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[s] || ""}`}>{label}</span>;
      },
    },
  ], [t, statusOptions, isPanelOpen]);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] animate-fade-in">
      <div className="flex-1 min-w-0 overflow-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-primary" />{t("shipping.customerPo.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("shipping.customerPo.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => { panelAnimateRef.current = !isPanelOpen; setEditingItem(null); setIsPanelOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />{t("common.register")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          <StatCard label={t("shipping.customerPo.statTotal")} value={stats.total} icon={FileText} color="blue" />
          <StatCard label={t("shipping.customerPo.statusReceived")} value={stats.received} icon={Clock} color="gray" />
          <StatCard label={t("shipping.customerPo.statusConfirmed")} value={stats.confirmed} icon={CheckCircle} color="green" />
          <StatCard label={t("shipping.customerPo.statusInProduction")} value={stats.inProduction} icon={Factory} color="yellow" />
          <StatCard label={t("shipping.customerPo.statusShipped")} value={stats.shipped} icon={Truck} color="purple" />
        </div>

        <Card><CardContent>
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("shipping.customerPo.title")}
            onRowClick={(row) => { if (isPanelOpen) setEditingItem(row); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("shipping.customerPo.searchPlaceholder")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
                </div>
              </div>
            }
          />
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <CustomerPoFormPanel
          editingItem={editingItem}
          onClose={handlePanelClose}
          onSave={handlePanelSave}
          animate={panelAnimateRef.current}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.orderNo || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
