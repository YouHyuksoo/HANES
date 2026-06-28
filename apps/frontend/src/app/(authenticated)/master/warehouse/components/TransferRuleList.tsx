/**
 * @file src/app/(authenticated)/master/warehouse/components/TransferRuleList.tsx
 * @description 창고이동규칙 탭 - API 연동 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/transfer-rules
 * 2. 출발창고 → 도착창고 이동 허용 여부 관리
 * 3. 창고 목록은 /inventory/warehouses에서 동적 로드
 */
import { useState, useEffect, useCallback, useMemo, useRef, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw, ArrowRightLeft } from "lucide-react";
import { Card, CardContent, Button, Input, Select, ConfirmModal } from "@/components/ui";
import { FieldInput, FieldSelect } from "./WarehouseFieldHelp";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

const EMPTY_RULE_FORM = { fromWarehouseId: "", toWarehouseId: "", allowYn: "Y", remark: "" };

interface TransferRule {
  fromWarehouseId: string;
  fromWarehouseCode?: string;
  fromWarehouseName?: string;
  toWarehouseId: string;
  toWarehouseCode?: string;
  toWarehouseName?: string;
  allowYn: string;
  remark?: string;
}

interface WarehouseOption { value: string; label: string; }

interface Props {
  onHeaderActions?: (actions: ReactNode) => void;
}

export default function TransferRuleList({ onHeaderActions }: Props) {
  const { t } = useTranslation();
  const [data, setData] = useState<TransferRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TransferRule | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState(EMPTY_RULE_FORM);
  const initialFormRef = useRef(EMPTY_RULE_FORM);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; fromId: string; toId: string }>({ open: false, fromId: "", toId: "" });
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  const fetchWarehouses = useCallback(async () => {
    try {
      const res = await api.get("/inventory/warehouses");
      const raw = res.data?.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      setWarehouseOptions(list.map((w: any) => ({ value: w.warehouseCode, label: `${w.warehouseCode} ${w.warehouseName}` })));
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/master/transfer-rules", { params });
      const raw = res.data?.data;
      setData(Array.isArray(raw) ? raw : raw?.data ?? []);
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
    setForm(EMPTY_RULE_FORM);
    initialFormRef.current = EMPTY_RULE_FORM;
    setIsPanelOpen(true);
  }, []);

  const openEdit = useCallback((item: TransferRule) => {
    setEditingItem(item);
    const init = { fromWarehouseId: item.fromWarehouseId, toWarehouseId: item.toWarehouseId, allowYn: item.allowYn, remark: item.remark || "" };
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
    if (!form.fromWarehouseId || !form.toWarehouseId) return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/master/transfer-rules/${editingItem.fromWarehouseId}/${editingItem.toWarehouseId}`, form);
      } else {
        await api.post("/master/transfer-rules", form);
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
      await api.delete(`/master/transfer-rules/${confirmModal.fromId}/${confirmModal.toId}`);
      setConfirmModal({ open: false, fromId: "", toId: "" });
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [confirmModal.fromId, confirmModal.toId, fetchData]);

  // 헤더 버튼을 부모 페이지에 전달
  useEffect(() => {
    onHeaderActions?.(
      <>
        <Button variant="secondary" size="sm" onClick={fetchData}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
        <Button size="sm" onClick={() => guard(openCreate)}>
          <Plus className="w-4 h-4 mr-1" />{t("master.transferRule.addRule")}
        </Button>
      </>
    );
  }, [onHeaderActions, fetchData, openCreate, guard, loading, t]);

  const columns = useMemo<ColumnDef<TransferRule>[]>(() => [
    { id: "actions", header: "", size: 80, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); guard(() => openEdit(row.original)); }} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button onClick={(e) => { e.stopPropagation(); setConfirmModal({ open: true, fromId: row.original.fromWarehouseId, toId: row.original.toWarehouseId }); }} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
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
  ], [t, openEdit, guard]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
          <DataGrid
            data={data}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("master.transferRule.title")}
            onRowClick={(row) => { if (isPanelOpen) guard(() => openEdit(row)); }}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.transferRule.searchPlaceholder")} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
              </div>
            }

          sqlQuery={`SELECT *\nFROM WAREHOUSE_TRANSFER_RULES\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        </CardContent></Card>
      </div>

      {isPanelOpen && (
        <div className="w-[440px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-bold text-text">
              {editingItem ? t("master.transferRule.editRule") : t("master.transferRule.addRule")}
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => guard(() => setIsPanelOpen(false))}>{t("common.cancel")}</Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !form.fromWarehouseId || !form.toWarehouseId}>{saving ? t("common.saving") : t("common.save", "저장")}</Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldSelect field="fromWarehouse" label={t("master.transferRule.fromWarehouse")} options={warehouseOptions} value={form.fromWarehouseId} onChange={(v) => setForm(p => ({ ...p, fromWarehouseId: v }))} required />
              <FieldSelect field="toWarehouse" label={t("master.transferRule.toWarehouse")} options={warehouseOptions} value={form.toWarehouseId} onChange={(v) => setForm(p => ({ ...p, toWarehouseId: v }))} required />
              <FieldSelect field="allowYn" label={t("master.transferRule.allowYn")} options={[{ value: "Y", label: t("master.transferRule.allowed") }, { value: "N", label: t("master.transferRule.denied") }]} value={form.allowYn} onChange={(v) => setForm(p => ({ ...p, allowYn: v }))} />
              <FieldInput field="ruleRemark" label={t("common.remark")} value={form.remark} onChange={(e) => setForm(p => ({ ...p, remark: e.target.value }))} wrapperClassName="col-span-2" />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmModal.open} onClose={() => setConfirmModal({ open: false, fromId: "", toId: "" })} onConfirm={handleDelete} title={t("master.transferRule.deleteRule")} message={t("master.transferRule.deleteConfirm")} variant="danger" />
      <ConfirmModal {...guardModalProps} />
    </div>
  );
}
