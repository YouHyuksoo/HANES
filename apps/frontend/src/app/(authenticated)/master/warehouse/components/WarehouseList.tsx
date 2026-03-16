/**
 * @file src/app/(authenticated)/master/warehouse/components/WarehouseList.tsx
 * @description 창고 목록 탭 - 창고 마스터 CRUD (API 연동)
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /inventory/warehouses
 * 2. 창고유형별 필터링 + 검색 지원
 * 3. 기본창고 지정, 소프트 삭제
 */
import { useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, Check, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { WarehouseData, WAREHOUSE_TYPE_COLORS } from "../types";
import WarehouseForm from "./WarehouseForm";
import api from "@/services/api";

interface Props {
  onHeaderActions?: (actions: ReactNode) => void;
}

export default function WarehouseList({ onHeaderActions }: Props) {
  const { t } = useTranslation();
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseData | null>(null);
  const [filterType, setFilterType] = useState("");
  const [searchText, setSearchText] = useState("");

  const WAREHOUSE_TYPES = useMemo(() => [
    { value: "", label: t("inventory.warehouse.warehouseType") },
    { value: "RAW", label: t("inventory.warehouse.rawWarehouse") },
    { value: "WIP", label: t("inventory.warehouse.wipWarehouse") },
    { value: "FG", label: t("inventory.warehouse.fgWarehouse") },
    { value: "FLOOR", label: t("inventory.warehouse.floorWarehouse") },
    { value: "DEFECT", label: t("inventory.warehouse.defectWarehouse") },
    { value: "SCRAP", label: t("inventory.warehouse.scrapWarehouse") },
    { value: "SUBCON", label: t("inventory.warehouse.subconWarehouse") },
  ], [t]);

  const warehouseFilterOptions = useMemo(() => [
    { value: "", label: t("inventory.warehouse.warehouseType") + ": " + t("common.all") },
    ...WAREHOUSE_TYPES.filter(wt => wt.value).map(wt => ({
      value: wt.value,
      label: t("inventory.warehouse.warehouseType") + ": " + wt.label,
    })),
  ], [t, WAREHOUSE_TYPES]);

  const getTypeLabel = (type: string) => WAREHOUSE_TYPES.find(wt => wt.value === type)?.label || type;

  const [formData, setFormData] = useState({
    warehouseCode: "", warehouseName: "", warehouseType: "RAW",
    plantCode: "", lineCode: "", processCode: "", isDefault: false,
  });

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({
    open: false, title: "", message: "", onConfirm: () => {},
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterType) params.warehouseType = filterType;
      const res = await api.get("/inventory/warehouses", { params });
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      setWarehouses(list);
    } catch {
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!searchText) return warehouses;
    const s = searchText.toLowerCase();
    return warehouses.filter(w => w.warehouseCode.toLowerCase().includes(s) || w.warehouseName.toLowerCase().includes(s));
  }, [warehouses, searchText]);

  const handleCreate = useCallback(() => {
    setEditingWarehouse(null);
    setFormData({ warehouseCode: "", warehouseName: "", warehouseType: "RAW", plantCode: "", lineCode: "", processCode: "", isDefault: false });
    setModalOpen(true);
  }, []);

  const handleEdit = (warehouse: WarehouseData) => {
    setEditingWarehouse(warehouse);
    setFormData({
      warehouseCode: warehouse.warehouseCode, warehouseName: warehouse.warehouseName,
      warehouseType: warehouse.warehouseType, plantCode: warehouse.plantCode || "",
      lineCode: warehouse.lineCode || "", processCode: warehouse.processCode || "", isDefault: warehouse.isDefault,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingWarehouse) {
        await api.put(`/inventory/warehouses/${editingWarehouse.warehouseCode}`, formData);
      } else {
        await api.post("/inventory/warehouses", formData);
      }
      setModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (warehouseCode: string) => {
    setConfirmModal({
      open: true, title: t("inventory.warehouse.deleteWarehouse"), message: t("inventory.warehouse.deleteConfirm"),
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        try {
          await api.delete(`/inventory/warehouses/${warehouseCode}`);
          fetchData();
        } catch (e) {
          console.error("Delete failed:", e);
        }
      },
    });
  };

  // 헤더 버튼을 부모 페이지에 전달
  useEffect(() => {
    onHeaderActions?.(
      <>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
        <Button size="sm" onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-1" />{t("inventory.warehouse.newWarehouse")}
        </Button>
      </>
    );
  }, [onHeaderActions, fetchData, handleCreate, loading, t]);

  const columns: ColumnDef<WarehouseData>[] = useMemo(() => [
    { id: "actions", header: "", size: 100, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => handleEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}><Pencil className="w-4 h-4 text-primary" /></button>
        <button onClick={() => handleDelete(row.original.warehouseCode)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    )},
    { accessorKey: "warehouseCode", header: t("inventory.warehouse.warehouseCode"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "warehouseName", header: t("inventory.warehouse.warehouseName"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "warehouseType", header: t("inventory.warehouse.warehouseType"), size: 120, meta: { filterType: "multi" as const }, cell: ({ getValue }) => {
      const type = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs font-medium ${WAREHOUSE_TYPE_COLORS[type] || "bg-gray-100 text-gray-800"}`}>{getTypeLabel(type)}</span>;
    }},
    { accessorKey: "lineCode", header: t("inventory.warehouse.line"), size: 80, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "processCode", header: t("inventory.warehouse.process"), size: 80, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "isDefault", header: t("inventory.warehouse.default"), size: 60, meta: { filterType: "multi" as const }, cell: ({ getValue }) => getValue() ? <Check className="h-4 w-4 text-green-600" /> : "-" },
    { accessorKey: "useYn", header: t("inventory.warehouse.use"), size: 60, meta: { filterType: "multi" as const }, cell: ({ getValue }) => {
      const v = getValue() as string;
      return <span className={`px-2 py-1 rounded text-xs ${v === "Y" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>{v}</span>;
    }},
  ], [t]);

  return (
    <div className="h-full flex flex-col">
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid
          data={filtered}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("inventory.warehouse.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("inventory.warehouse.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select options={warehouseFilterOptions} value={filterType} onChange={(v) => setFilterType(v)} fullWidth />
              </div>
            </div>
          }
        />
      </CardContent></Card>

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} variant="danger" />

      <WarehouseForm isOpen={modalOpen} isEdit={!!editingWarehouse} formData={formData} typeOptions={WAREHOUSE_TYPES.filter(wt => wt.value !== "")} onClose={() => setModalOpen(false)} onChange={setFormData} onSave={handleSave} />
    </div>
  );
}
