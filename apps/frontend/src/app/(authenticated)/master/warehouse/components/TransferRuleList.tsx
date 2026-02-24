/**
 * @file src/app/(authenticated)/master/warehouse/components/TransferRuleList.tsx
 * @description 창고이동규칙 탭 - API 연동 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/transfer-rules
 * 2. 출발창고 → 도착창고 이동 허용 여부 관리
 * 3. 창고 목록은 /inventory/warehouses에서 동적 로드
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface TransferRule {
  id: string;
  fromWarehouseId: string;
  fromWarehouseCode?: string;
  fromWarehouseName?: string;
  toWarehouseId: string;
  toWarehouseCode?: string;
  toWarehouseName?: string;
  allowYn: string;
  remark?: string;
}

interface WarehouseOption {
  value: string;
  label: string;
}

export default function TransferRuleList() {
  const { t } = useTranslation();
  const [data, setData] = useState<TransferRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransferRule | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState({ fromWarehouseId: "", toWarehouseId: "", allowYn: "Y", remark: "" });
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; id: string }>({ open: false, id: "" });

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/inventory/warehouses");
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setWarehouseOptions(list.map((w: any) => ({ value: w.id, label: `${w.warehouseCode} ${w.warehouseName}` })));
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/master/transfer-rules", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ fromWarehouseId: "", toWarehouseId: "", allowYn: "Y", remark: "" });
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((item: TransferRule) => {
    setEditingItem(item);
    setForm({ fromWarehouseId: item.fromWarehouseId, toWarehouseId: item.toWarehouseId, allowYn: item.allowYn, remark: item.remark || "" });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/master/transfer-rules/${editingItem.id}`, form);
      } else {
        await api.post("/master/transfer-rules", form);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editingItem, form, fetchData]);

  const handleDelete = useCallback(async () => {
    try {
      await api.delete(`/master/transfer-rules/${confirmModal.id}`);
      setConfirmModal({ open: false, id: "" });
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [confirmModal.id, fetchData]);

  const columns = useMemo<ColumnDef<TransferRule>[]>(() => [
    { id: "actions", header: "", size: 80, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button onClick={() => setConfirmModal({ open: true, id: row.original.id })} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
    { accessorKey: "fromWarehouseCode", header: t("master.transferRule.fromWarehouseCode"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "fromWarehouseName", header: t("master.transferRule.fromWarehouseName"), size: 140, meta: { filterType: "text" as const } },
    { id: "arrow", header: "", size: 40, meta: { filterType: "none" as const }, cell: () => <ArrowRightLeft className="w-4 h-4 text-text-muted mx-auto" /> },
    { accessorKey: "toWarehouseCode", header: t("master.transferRule.toWarehouseCode"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "toWarehouseName", header: t("master.transferRule.toWarehouseName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "allowYn", header: t("master.transferRule.allow"), size: 70, meta: { filterType: "multi" as const }, cell: ({ getValue }) => (
      <span className={`px-2 py-1 text-xs rounded-full ${getValue() === "Y" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
        {getValue() === "Y" ? t("master.transferRule.allowed") : t("master.transferRule.denied")}
      </span>
    )},
    { accessorKey: "remark", header: t("common.remark"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
  ], [t, openEdit]);

  return (
    <>
      <Card><CardContent>
        <DataGrid
          data={data}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("master.transferRule.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("master.transferRule.searchPlaceholder")} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <Button variant="secondary" size="sm" onClick={fetchData} className="flex-shrink-0">
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
              </Button>
              <Button size="sm" onClick={openCreate} className="flex-shrink-0">
                <Plus className="w-4 h-4 mr-1" />{t("master.transferRule.addRule")}
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("master.transferRule.editRule") : t("master.transferRule.addRule")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Select label={t("master.transferRule.fromWarehouse")} options={warehouseOptions} value={form.fromWarehouseId} onChange={(v) => setForm(p => ({ ...p, fromWarehouseId: v }))} fullWidth />
          <Select label={t("master.transferRule.toWarehouse")} options={warehouseOptions} value={form.toWarehouseId} onChange={(v) => setForm(p => ({ ...p, toWarehouseId: v }))} fullWidth />
          <Select label={t("master.transferRule.allowYn")} options={[{ value: "Y", label: t("master.transferRule.allowed") }, { value: "N", label: t("master.transferRule.denied") }]} value={form.allowYn} onChange={(v) => setForm(p => ({ ...p, allowYn: v }))} fullWidth />
          <Input label={t("common.remark")} placeholder={t("common.remark")} value={form.remark} onChange={(e) => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.add")}</Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal({ open: false, id: "" })} onConfirm={handleDelete} title={t("master.transferRule.deleteRule")} message={t("master.transferRule.deleteConfirm")} variant="danger" />
    </>
  );
}
