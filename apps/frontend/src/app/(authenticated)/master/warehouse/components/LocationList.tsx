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
import { useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import { FieldInput, FieldSelect } from "./WarehouseFieldHelp";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

interface WarehouseLocation {
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

interface WhOption { value: string; label: string; }

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

interface Props {
  onHeaderActions?: (actions: ReactNode) => void;
}

export default function LocationList({ onHeaderActions }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [whFilter, setWhFilter] = useState("");
  const [whOptions, setWhOptions] = useState<WhOption[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseLocation | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const initialFormRef = useRef<FormState>(INITIAL_FORM);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; compositeKey: string }>({ open: false, compositeKey: "" });
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/inventory/warehouses");
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      setWhOptions(list.map((w: any) => ({ value: w.warehouseCode, label: `${w.warehouseCode} - ${w.warehouseName}` })));
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (whFilter) params.warehouseCode = whFilter;
      const res = await api.get("/inventory/warehouse-locations", { params });
      const raw = res.data?.data;
      setData(Array.isArray(raw) ? raw : raw?.data ?? []);
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
    { value: "", label: t("common.warehouse") + ": " + t("common.all") },
    ...whOptions.map(o => ({ ...o, label: t("common.warehouse") + ": " + o.label })),
  ], [t, whOptions]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    const init = { ...INITIAL_FORM, warehouseCode: whFilter || "" };
    setForm(init);
    initialFormRef.current = init;
    setIsPanelOpen(true);
  }, [whFilter]);

  const openEdit = useCallback((item: WarehouseLocation) => {
    setEditingItem(item);
    const init: FormState = {
      warehouseCode: item.warehouseCode,
      locationCode: item.locationCode,
      locationName: item.locationName,
      zone: item.zone || "",
      rowNo: item.rowNo || "",
      colNo: item.colNo || "",
      levelNo: item.levelNo || "",
      remark: item.remark || "",
    };
    setForm(init);
    initialFormRef.current = init;
    setIsPanelOpen(true);
  }, []);

  // 작성 중(저장 안 됨) 여부 계산 후 보고 — 행 전환 시 유실 방어
  const dirty = useMemo(
    () => isPanelOpen && JSON.stringify(form) !== JSON.stringify(initialFormRef.current),
    [isPanelOpen, form],
  );
  useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);

  const handleSave = useCallback(async () => {
    if (!form.warehouseCode || !form.locationCode || !form.locationName) return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/inventory/warehouse-locations/${editingItem.warehouseCode}::${editingItem.locationCode}`, {
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
      markDirty(false);
      setIsPanelOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editingItem, form, fetchData, markDirty]);

  const handleDelete = useCallback(async () => {
    try {
      await api.delete(`/inventory/warehouse-locations/${confirmModal.compositeKey}`);
      setConfirmModal({ open: false, compositeKey: "" });
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [confirmModal.compositeKey, fetchData]);

  // 헤더 버튼을 부모 페이지에 전달
  useEffect(() => {
    onHeaderActions?.(
      <>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
        <Button size="sm" onClick={() => guard(openCreate)}>
          <Plus className="w-4 h-4 mr-1" />{t("inventory.location.addLocation")}
        </Button>
      </>
    );
  }, [onHeaderActions, fetchData, openCreate, guard, loading, t]);

  const columns = useMemo<ColumnDef<WarehouseLocation>[]>(() => [
    { id: "actions", header: "", size: 80, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); guard(() => openEdit(row.original)); }} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button onClick={(e) => { e.stopPropagation(); setConfirmModal({ open: true, compositeKey: `${row.original.warehouseCode}::${row.original.locationCode}` }); }} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
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
  ], [t, openEdit, guard]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={filtered}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("inventory.location.title")}
            onRowClick={(row) => { if (isPanelOpen) guard(() => openEdit(row)); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("inventory.location.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-56 flex-shrink-0">
                  <Select options={filterOptions} value={whFilter} onChange={setWhFilter} fullWidth />
                </div>
              </div>
            }

          sqlQuery={`SELECT *\nFROM WAREHOUSE_LOCATIONS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <div className="w-[440px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-bold text-text">
              {editingItem ? t("inventory.location.editLocation") : t("inventory.location.addLocation")}
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => guard(() => setIsPanelOpen(false))}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !form.warehouseCode || !form.locationCode || !form.locationName}>{saving ? t("common.saving") : t("common.save", "저장")}</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect field="locationWarehouse" label={t("inventory.warehouse.warehouseName")} options={whOptions} value={form.warehouseCode} onChange={(v) => setForm((p) => ({ ...p, warehouseCode: v }))} disabled={!!editingItem} required />
              <FieldInput field="locationCode" label={t("inventory.location.locationCode")} value={form.locationCode} onChange={(e) => setForm((p) => ({ ...p, locationCode: e.target.value }))} disabled={!!editingItem} required />
              <FieldInput field="locationName" label={t("inventory.location.locationName")} value={form.locationName} onChange={(e) => setForm((p) => ({ ...p, locationName: e.target.value }))} required wrapperClassName="col-span-2" />
              <FieldInput field="zone" label={t("inventory.location.zone")} value={form.zone} onChange={(e) => setForm((p) => ({ ...p, zone: e.target.value }))} />
              <FieldInput field="rowNo" label={t("inventory.location.rowNo")} value={form.rowNo} onChange={(e) => setForm((p) => ({ ...p, rowNo: e.target.value }))} />
              <FieldInput field="colNo" label={t("inventory.location.colNo")} value={form.colNo} onChange={(e) => setForm((p) => ({ ...p, colNo: e.target.value }))} />
              <FieldInput field="levelNo" label={t("inventory.location.levelNo")} value={form.levelNo} onChange={(e) => setForm((p) => ({ ...p, levelNo: e.target.value }))} />
              <FieldInput field="locationRemark" label={t("common.remark")} value={form.remark} onChange={(e) => setForm((p) => ({ ...p, remark: e.target.value }))} wrapperClassName="col-span-2" />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal({ open: false, compositeKey: "" })} onConfirm={handleDelete} title={t("inventory.location.deleteLocation")} message={t("inventory.location.deleteConfirm")} variant="danger" />
      <ConfirmModal {...guardModalProps} />
    </div>
  );
}
