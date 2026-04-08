"use client";

/**
 * @file src/app/(authenticated)/material/po/page.tsx
 * @description PO관리 페이지 — 단일 그리드 + 우측 사이드패널 등록/수정
 *
 * 초보자 가이드:
 * 1. 단일 DataGrid에 PO 목록 + 품목수 표시
 * 2. 등록/수정 버튼 → 우측 PoFormPanel 슬라이드
 * 3. API: GET/POST/PUT/DELETE /material/purchase-orders
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart, Plus, Edit2, Trash2, Search, RefreshCw,
  CheckCircle, Truck, Archive,
} from "lucide-react";
import { Card, CardContent, Button, Input, StatCard, ConfirmModal } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import PoFormPanel from "./components/PoFormPanel";
import type { PurchaseOrder } from "./components/PoFormPanel";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  CONFIRMED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  PARTIAL: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  RECEIVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CLOSED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

export default function PoPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrder | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/material/purchase-orders", { params });
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
    confirmed: data.filter(d => d.status === "CONFIRMED").length,
    partial: data.filter(d => d.status === "PARTIAL").length,
    received: data.filter(d => d.status === "RECEIVED").length,
  }), [data]);

  const openCreate = useCallback(() => {
    setEditingPo(null);
    setIsFormOpen(true);
  }, []);

  const openEdit = useCallback((po: PurchaseOrder) => {
    setEditingPo(po);
    setIsFormOpen(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setIsFormOpen(false);
    setEditingPo(null);
  }, []);

  const handleFormSave = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/material/purchase-orders/${deleteTarget.poNo}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
    {
      id: "actions", header: "", size: 70,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "poNo", header: t("material.po.poNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "partnerName", header: t("material.po.partnerName"), size: 130,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "orderDate", header: t("material.po.orderDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      accessorKey: "dueDate", header: t("material.po.dueDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      id: "itemCount", header: t("material.po.itemCount", "품목수"), size: 70,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.items?.length ?? 0}</span>
      ),
    },
    {
      accessorKey: "totalAmount", header: t("material.po.totalAmount"), size: 120,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold">
          {(getValue() as number | null)?.toLocaleString() ?? "-"}
        </span>
      ),
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
  ], [t, openEdit]);

  return (
    <div className="h-full flex overflow-hidden animate-fade-in">
      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col p-6 gap-4 min-w-0">
        {/* 헤더 */}
        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h1 className="text-xl font-bold text-text flex items-center gap-2">
              <ShoppingCart className="w-7 h-7 text-primary" />{t("material.po.title")}
            </h1>
            <p className="text-text-muted mt-1">{t("material.po.subtitle")}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={fetchData}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-1" />{t("common.register")}
            </Button>
          </div>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-4 gap-3 flex-shrink-0">
          <StatCard label={t("material.po.stats.total")} value={stats.total}
            icon={ShoppingCart} color="blue" />
          <StatCard label={t("material.po.stats.confirmed")} value={stats.confirmed}
            icon={CheckCircle} color="yellow" />
          <StatCard label={t("material.po.stats.partial")} value={stats.partial}
            icon={Truck} color="orange" />
          <StatCard label={t("material.po.stats.received")} value={stats.received}
            icon={Archive} color="green" />
        </div>

        {/* PO 그리드 */}
        <div className="flex-1 min-h-0">
          <Card className="h-full overflow-hidden" padding="none">
            <CardContent className="h-full p-4">
              <DataGrid data={data} columns={columns} isLoading={loading}
                enableColumnFilter enableExport exportFileName={t("material.po.title")}
                onRowClick={(row) => openEdit(row)}
                getRowId={(row) => row.poNo}
                toolbarLeft={
                  <div className="flex gap-3 flex-1 min-w-0">
                    <div className="flex-1 min-w-0">
                      <Input placeholder={t("material.po.searchPlaceholder")}
                        value={searchText} onChange={e => setSearchText(e.target.value)}
                        leftIcon={<Search className="w-4 h-4" />} fullWidth />
                    </div>
                    <div className="w-36 flex-shrink-0">
                      <ComCodeSelect groupCode="PO_STATUS"
                        value={statusFilter} onChange={setStatusFilter} fullWidth />
                    </div>
                  </div>
                } />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 사이드패널 */}
      {isFormOpen && (
        <PoFormPanel editData={editingPo} onClose={handleFormClose} onSave={handleFormSave} />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.poNo || ""}'${t("common.deleteConfirm") || "을(를) 삭제하시겠습니까?"}`}
      />
    </div>
  );
}
