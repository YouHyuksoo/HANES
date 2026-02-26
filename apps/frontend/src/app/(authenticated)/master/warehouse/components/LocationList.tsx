"use client";

/**
 * @file components/LocationList.tsx
 * @description 창고 로케이션(세부위치) 탭 - API 연동 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /inventory/warehouse-locations
 * 2. 창고별 로케이션 목록 표시 + 모달로 등록/수정
 * 3. 창고 필터 드롭다운으로 특정 창고의 로케이션만 조회
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface WarehouseLocation {
  id: string;
  warehouseCode: string;
  warehouseName: string;
  locationCode: string;
  locationName: string;
  zone: string | null;
  rowNo: string | null;
  colNo: string | null;
  levelNo: string | null;
  useYn: string;
  remark: string | null;
}

interface WhOption {
  value: string;
  label: string;
}

interface FormState {
  warehouseCode: string;
  locationCode: string;
  locationName: string;
  zone: string;
  rowNo: string;
  colNo: string;
  levelNo: string;
  remark: string;
}

const INITIAL_FORM: FormState = {
  warehouseCode: "", locationCode: "", locationName: "",
  zone: "", rowNo: "", colNo: "", levelNo: "", remark: "",
};

export default function LocationList() {
  const { t } = useTranslation();
  const [data, setData] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [whFilter, setWhFilter] = useState("");
  const [whOptions, setWhOptions] = useState<WhOption[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseLocation | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; id: string }>({ open: false, id: "" });

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/inventory/warehouses");
      const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      setWhOptions(list.map((w: any) => ({ value: w.id, label: `${w.warehouseCode} - ${w.warehouseName}` })));
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (whFilter) params.warehouseCode = whFilter;
      const res = await api.get("/inventory/warehouse-locations", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [whFilter]);

  useEffect(() => { fetchWarehouses(); }, [fetchWarehouses]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!searchText) return data;
    const s = searchText.toLowerCase();
    return data.filter((d) =>
      d.locationCode.toLowerCase().includes(s) ||
      d.locationName.toLowerCase().includes(s) ||
      (d.zone || "").toLowerCase().includes(s)
    );
  }, [data, searchText]);

  const filterOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    ...whOptions,
  ], [t, whOptions]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ ...INITIAL_FORM, warehouseCode: whFilter || "" });
    setIsModalOpen(true);
  }, [whFilter]);

  const openEdit = useCallback((item: WarehouseLocation) => {
    setEditingItem(item);
    setForm({
      warehouseCode: item.warehouseCode,
      locationCode: item.locationCode,
      locationName: item.locationName,
      zone: item.zone || "",
      rowNo: item.rowNo || "",
      colNo: item.colNo || "",
      levelNo: item.levelNo || "",
      remark: item.remark || "",
    });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.warehouseCode || !form.locationCode || !form.locationName) return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/inventory/warehouse-locations/${editingItem.id}`, {
          locationName: form.locationName,
          zone: form.zone || undefined,
          rowNo: form.rowNo || undefined,
          colNo: form.colNo || undefined,
          levelNo: form.levelNo || undefined,
          remark: form.remark || undefined,
        });
      } else {
        await api.post("/inventory/warehouse-locations", form);
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
      await api.delete(`/inventory/warehouse-locations/${confirmModal.id}`);
      setConfirmModal({ open: false, id: "" });
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [confirmModal.id, fetchData]);

  const columns = useMemo<ColumnDef<WarehouseLocation>[]>(() => [
    { id: "actions", header: "", size: 80, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button onClick={() => setConfirmModal({ open: true, id: row.original.id })} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
    { accessorKey: "warehouseCode", header: t("inventory.warehouse.warehouseCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "warehouseName", header: t("inventory.warehouse.warehouseName"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "locationCode", header: t("inventory.location.locationCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "locationName", header: t("inventory.location.locationName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "zone", header: t("inventory.location.zone"), size: 70, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "rowNo", header: t("inventory.location.rowNo"), size: 60, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "colNo", header: t("inventory.location.colNo"), size: 60, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "levelNo", header: t("inventory.location.levelNo"), size: 60, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "useYn", header: t("inventory.warehouse.use"), size: 60, meta: { filterType: "multi" as const }, cell: ({ getValue }) => (
      <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
    )},
    { accessorKey: "remark", header: t("common.remark"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
  ], [t, openEdit]);

  return (
    <>
      <Card><CardContent>
        <DataGrid
          data={filtered}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("inventory.location.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("inventory.location.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-56 flex-shrink-0">
                <Select options={filterOptions} value={whFilter} onChange={setWhFilter} fullWidth />
              </div>
              <Button variant="secondary" size="sm" onClick={fetchData} className="flex-shrink-0">
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
              </Button>
              <Button size="sm" onClick={openCreate} className="flex-shrink-0">
                <Plus className="w-4 h-4 mr-1" />{t("inventory.location.addLocation")}
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("inventory.location.editLocation") : t("inventory.location.addLocation")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Select label={t("inventory.warehouse.warehouseName")} options={whOptions} value={form.warehouseCode} onChange={(v) => setForm((p) => ({ ...p, warehouseCode: v }))} disabled={!!editingItem} fullWidth />
          <Input label={t("inventory.location.locationCode")} placeholder="A-01-01" value={form.locationCode} onChange={(e) => setForm((p) => ({ ...p, locationCode: e.target.value }))} disabled={!!editingItem} fullWidth />
          <div className="col-span-2">
            <Input label={t("inventory.location.locationName")} placeholder={t("inventory.location.locationName")} value={form.locationName} onChange={(e) => setForm((p) => ({ ...p, locationName: e.target.value }))} fullWidth />
          </div>
          <Input label={t("inventory.location.zone")} placeholder="A" value={form.zone} onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))} fullWidth />
          <Input label={t("inventory.location.rowNo")} placeholder="01" value={form.rowNo} onChange={(e) => setForm((p) => ({ ...p, rowNo: e.target.value }))} fullWidth />
          <Input label={t("inventory.location.colNo")} placeholder="01" value={form.colNo} onChange={(e) => setForm((p) => ({ ...p, colNo: e.target.value }))} fullWidth />
          <Input label={t("inventory.location.levelNo")} placeholder="1" value={form.levelNo} onChange={(e) => setForm((p) => ({ ...p, levelNo: e.target.value }))} fullWidth />
          <div className="col-span-2">
            <Input label={t("common.remark")} placeholder={t("common.remark")} value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.add")}</Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal({ open: false, id: "" })} onConfirm={handleDelete} title={t("inventory.location.deleteLocation")} message={t("inventory.location.deleteConfirm")} variant="danger" />
    </>
  );
}
