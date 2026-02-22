"use client";

/**
 * @file src/app/(authenticated)/shipping/return/page.tsx
 * @description 출하반품등록 페이지 - 출하반품 CRUD 및 품목 관리
 *
 * 초보자 가이드:
 * 1. **출하반품**: 출하 후 고객사에서 반품된 품목을 등록/관리
 * 2. **상태 흐름**: DRAFT -> CONFIRMED -> COMPLETED
 * 3. API: GET/POST/PUT/DELETE /shipping/returns
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  Undo2, Plus, Search, RefreshCw, Edit2, Trash2,
  FileText, Clock, CheckCircle, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard, ComCodeBadge, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { usePartnerOptions } from "@/hooks/useMasterOptions";
import api from "@/services/api";

interface ShipReturn {
  id: string;
  returnNo: string;
  shipOrderNo: string;
  customerName: string;
  customerId: string;
  returnDate: string;
  returnReason: string;
  status: string;
  itemCount: number;
  totalQty: number;
  remark: string;
}

export default function ShipReturnPage() {
  const { t } = useTranslation();
  const { options: customerOptions } = usePartnerOptions("CUSTOMER");
  const [data, setData] = useState<ShipReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ShipReturn | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShipReturn | null>(null);
  const [form, setForm] = useState({ returnNo: "", shipOrderNo: "", customerId: "", returnDate: "", returnReason: "", remark: "" });

  const statusOptions = useMemo(() => [
    { value: "", label: t("common.allStatus") },
    { value: "DRAFT", label: t("shipping.return.statusDraft") },
    { value: "CONFIRMED", label: t("shipping.return.statusConfirmed") },
    { value: "COMPLETED", label: t("shipping.return.statusCompleted") },
  ], [t]);

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/shipping/returns", { params });
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
    completed: data.filter((d) => d.status === "COMPLETED").length,
  }), [data]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ returnNo: "", shipOrderNo: "", customerId: "", returnDate: "", returnReason: "", remark: "" });
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((item: ShipReturn) => {
    setEditingItem(item);
    setForm({ returnNo: item.returnNo, shipOrderNo: item.shipOrderNo, customerId: item.customerId || "", returnDate: item.returnDate, returnReason: item.returnReason, remark: item.remark || "" });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/shipping/returns/${editingItem.id}`, form);
      } else {
        await api.post("/shipping/returns", form);
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
      await api.delete(`/shipping/returns/${deleteTarget.id}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<ShipReturn>[]>(() => [
    { accessorKey: "returnNo", header: t("shipping.return.returnNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "shipOrderNo", header: t("shipping.return.shipOrderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.return.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "returnDate", header: t("shipping.return.returnDate"), size: 100 },
    { accessorKey: "returnReason", header: t("shipping.return.returnReason"), size: 120 },
    { accessorKey: "totalQty", header: t("shipping.return.returnQty"), size: 80, cell: ({ getValue }) => <span className="font-medium">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "status", header: t("common.status"), size: 90, cell: ({ getValue }) => {
      const s = getValue() as string;
      const label = statusOptions.find(o => o.value === s)?.label || s;
      return <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[s] || ""}`}>{label}</span>;
    } },
    { id: "actions", header: "", size: 80, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    ) },
  ], [t, statusOptions, openEdit]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><Undo2 className="w-7 h-7 text-primary" />{t("shipping.return.title")}</h1>
          <p className="text-text-muted mt-1">{t("shipping.return.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
          </Button>
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("shipping.return.statTotal")} value={stats.total} icon={FileText} color="blue" />
        <StatCard label={t("shipping.return.statusDraft")} value={stats.draft} icon={Clock} color="yellow" />
        <StatCard label={t("shipping.return.statusConfirmed")} value={stats.confirmed} icon={AlertTriangle} color="red" />
        <StatCard label={t("shipping.return.statusCompleted")} value={stats.completed} icon={CheckCircle} color="green" />
      </div>
      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("shipping.return.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("shipping.return.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={statusOptions} value={statusFilter} onChange={setStatusFilter} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("shipping.return.editTitle") : t("shipping.return.addTitle")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("shipping.return.returnNo")} placeholder="RT-YYYYMMDD-NNN"
              value={form.returnNo} onChange={e => setForm(p => ({ ...p, returnNo: e.target.value }))} fullWidth />
            <Input label={t("shipping.return.shipOrderNo")} placeholder="SO-YYYYMMDD-NNN"
              value={form.shipOrderNo} onChange={e => setForm(p => ({ ...p, shipOrderNo: e.target.value }))} fullWidth />
            <Input label={t("shipping.return.returnDate")} type="date"
              value={form.returnDate} onChange={e => setForm(p => ({ ...p, returnDate: e.target.value }))} fullWidth />
            <Select label={t("shipping.return.customer")} options={customerOptions}
              value={form.customerId} onChange={v => setForm(p => ({ ...p, customerId: v }))} fullWidth />
          </div>
          <Input label={t("shipping.return.returnReason")} placeholder={t("shipping.return.returnReasonPlaceholder")}
            value={form.returnReason} onChange={e => setForm(p => ({ ...p, returnReason: e.target.value }))} fullWidth />
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
        message={`'${deleteTarget?.returnNo || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
