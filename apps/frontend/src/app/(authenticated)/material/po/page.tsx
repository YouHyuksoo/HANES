"use client";

/**
 * @file src/app/(authenticated)/material/po/page.tsx
 * @description PO관리 페이지 - 구매발주 CRUD
 *
 * 초보자 가이드:
 * 1. **PO 목록**: DataGrid로 발주 목록 표시
 * 2. **등록/수정**: Modal로 PO + 품목 입력
 * 3. API: GET/POST/PUT/DELETE /material/purchase-orders
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingCart, Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, StatCard, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface PurchaseOrder {
  id: string;
  poNo: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalAmount: number;
  itemCount: number;
}

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ poNo: "", partnerName: "", orderDate: "", dueDate: "", remark: "" });
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

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ poNo: "", partnerName: "", orderDate: "", dueDate: "", remark: "" });
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((item: PurchaseOrder) => {
    setEditingItem(item);
    setForm({ poNo: item.poNo, partnerName: item.partnerName, orderDate: item.orderDate, dueDate: item.dueDate, remark: "" });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.poNo || !form.partnerName) return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/material/purchase-orders/${editingItem.id}`, form);
      } else {
        await api.post("/material/purchase-orders", { ...form, items: [] });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editingItem, form, fetchData]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/material/purchase-orders/${deleteTarget.id}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<PurchaseOrder>[]>(() => [
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
      accessorKey: "itemCount", header: t("material.po.itemCount"), size: 80,
      meta: { align: "right" as const },
    },
    {
      accessorKey: "totalAmount", header: t("material.po.totalAmount"), size: 130,
      meta: { align: "right" as const },
      cell: ({ getValue }) => <span>{(getValue() as number).toLocaleString()}</span>,
    },
    {
      accessorKey: "status", header: t("common.status"), size: 100,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
    {
      id: "actions", header: "", size: 80,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t, openEdit]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ShoppingCart className="w-7 h-7 text-primary" />{t("material.po.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("material.po.subtitle")}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />{t("common.register")}
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("material.poStatus.stats.total")} value={stats.total} icon={ShoppingCart} color="blue" />
        <StatCard label="CONFIRMED" value={stats.confirmed} icon={ShoppingCart} color="yellow" />
        <StatCard label="PARTIAL" value={stats.partial} icon={ShoppingCart} color="orange" />
        <StatCard label="RECEIVED" value={stats.received} icon={ShoppingCart} color="green" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("material.po.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("material.po.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
              <Button variant="secondary" onClick={fetchData}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingItem ? t("common.edit") : t("common.register")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="PO No." placeholder="PO-YYYYMMDD-001"
            value={form.poNo} onChange={e => setForm(p => ({ ...p, poNo: e.target.value }))} fullWidth />
          <Input label={t("material.po.partnerName")} placeholder={t("material.po.partnerName")}
            value={form.partnerName} onChange={e => setForm(p => ({ ...p, partnerName: e.target.value }))} fullWidth />
          <Input label={t("material.po.orderDate")} type="date"
            value={form.orderDate} onChange={e => setForm(p => ({ ...p, orderDate: e.target.value }))} fullWidth />
          <Input label={t("material.po.dueDate")} type="date"
            value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving || !form.poNo || !form.partnerName}>
            {saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.register")}
          </Button>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.poNo || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
