"use client";

/**
 * @file src/app/(authenticated)/shipping/order/page.tsx
 * @description 출하지시등록 페이지 - 출하지시 CRUD 및 품목 관리
 *
 * 초보자 가이드:
 * 1. **출하지시**: 고객사에 출하할 품목과 수량을 지정하는 지시서
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> SHIPPING -> SHIPPED
 * 3. API: GET/POST/PUT/DELETE /shipping/ship-orders
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardList, Plus, Search, RefreshCw, Edit2, Trash2,
  FileText, Clock, CheckCircle, Truck,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface ShipOrder {
  id: string;
  shipOrderNo: string;
  customerName: string;
  customerId: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
  remark: string;
}

export default function ShipOrderPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<ShipOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipOrder | null>(null);
  const [form, setForm] = useState({ shipOrderNo: "", customerId: "", dueDate: "", shipDate: "", remark: "" });
  const [deleteTarget, setDeleteTarget] = useState<ShipOrder | null>(null);

  const comCodeStatusOptions = useComCodeOptions("SHIP_ORDER_STATUS");
  const { options: customerOptions } = usePartnerOptions("CUSTOMER");
  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") }, ...comCodeStatusOptions
  ], [t, comCodeStatusOptions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/ship-orders", { params });
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
    draft: data.filter((d) => d.status === "DRAFT").length,
    confirmed: data.filter((d) => d.status === "CONFIRMED").length,
    shipped: data.filter((d) => d.status === "SHIPPED" || d.status === "SHIPPING").length,
  }), [data]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ shipOrderNo: "", customerId: "", dueDate: "", shipDate: "", remark: "" });
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((item: ShipOrder) => {
    setEditingItem(item);
    setForm({ shipOrderNo: item.shipOrderNo, customerId: item.customerId || "", dueDate: item.dueDate, shipDate: item.shipDate, remark: item.remark || "" });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/shipping/ship-orders/${editingItem.id}`, form);
      } else {
        await api.post("/shipping/ship-orders", form);
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
      await api.delete(`/shipping/ship-orders/${deleteTarget.id}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<ShipOrder>[]>(() => [
    { accessorKey: "shipOrderNo", header: t("shipping.shipOrder.shipOrderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.shipOrder.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "dueDate", header: t("shipping.shipOrder.dueDate"), size: 100 },
    { accessorKey: "shipDate", header: t("shipping.shipOrder.shipDate"), size: 100 },
    { accessorKey: "itemCount", header: t("shipping.shipOrder.itemCount"), size: 70, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 90, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 90, cell: ({ getValue }) => <ComCodeBadge groupCode="SHIP_ORDER_STATUS" code={getValue() as string} /> },
    { id: "actions", header: "", size: 80, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    ) },
  ], [t, openEdit]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardList className="w-7 h-7 text-primary" />{t("shipping.shipOrder.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.shipOrder.subtitle")}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.shipOrder.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.shipOrder.statusDraft")} value={stats.draft} icon={Clock} color="yellow" />
        <StatCard label={t("shipping.shipOrder.statusConfirmed")} value={stats.confirmed} icon={CheckCircle} color="green" />
        <StatCard label={t("shipping.shipOrder.statusShipped")} value={stats.shipped} icon={Truck} color="purple" />
      </div>
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("shipping.shipOrder.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("shipping.shipOrder.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
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
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("shipping.shipOrder.editTitle") : t("shipping.shipOrder.addTitle")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("shipping.shipOrder.shipOrderNo")} placeholder="SO-YYYYMMDD-NNN"
              value={form.shipOrderNo} onChange={e => setForm(p => ({ ...p, shipOrderNo: e.target.value }))} fullWidth />
            <Select label={t("shipping.shipOrder.customer")} options={customerOptions}
              value={form.customerId} onChange={v => setForm(p => ({ ...p, customerId: v }))} fullWidth />
            <Input label={t("shipping.shipOrder.dueDate")} type="date"
              value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} fullWidth />
            <Input label={t("shipping.shipOrder.shipDate")} type="date"
              value={form.shipDate} onChange={e => setForm(p => ({ ...p, shipDate: e.target.value }))} fullWidth />
          </div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")}
            value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.register")}
            </Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        variant="danger"
        message={`'${deleteTarget?.shipOrderNo || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
