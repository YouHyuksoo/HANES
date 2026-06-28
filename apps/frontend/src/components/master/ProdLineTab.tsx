"use client";

/**
 * @file components/master/ProdLineTab.tsx
 * @description 생산라인 탭 - Oracle API 연동 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/prod-lines
 * 2. DataGrid로 목록 표시 + 모달로 등록/수정
 */
import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { FieldInput } from "@/app/(authenticated)/master/prod-line/components/ProdLineFieldHelp";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";

interface ProdLine {
  lineCode: string;
  lineName: string;
  whLoc?: string;
  erpCode?: string;
  oper?: string;
  lineType?: string;
  remark?: string;
  useYn: string;
}

interface Props {
  onHeaderActions?: (actions: ReactNode) => void;
}

export default function ProdLineTab({ onHeaderActions }: Props) {
  const { t } = useTranslation();
  const [lines, setLines] = useState<ProdLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProdLine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProdLine | null>(null);
  const [formData, setFormData] = useState<Partial<ProdLine>>({});
  const [saving, setSaving] = useState(false);
  const initialFormRef = useRef<Partial<ProdLine>>({});
  const panelAnimateRef = useRef(true);
  const { markDirty, guard, guardModalProps } = useUnsavedGuard();

  const fetchLines = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      const res = await api.get("/master/prod-lines", { params });
      if (res.data.success) setLines(res.data.data || []);
    } catch {
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [searchText]);

  useEffect(() => { fetchLines(); }, [fetchLines]);

  const openCreate = useCallback(() => {
    panelAnimateRef.current = true;
    const init: Partial<ProdLine> = { useYn: "Y" };
    setEditingLine(null);
    setFormData(init);
    initialFormRef.current = init;
    setIsPanelOpen(true);
  }, []);

  const openEdit = useCallback((line: ProdLine) => {
    setEditingLine(line);
    const init = { ...line };
    setFormData(init);
    initialFormRef.current = init;
    setIsPanelOpen(true);
  }, []);

  useEffect(() => {
    onHeaderActions?.(
      <>
        <Button variant="secondary" size="sm" onClick={fetchLines}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
        </Button>
        <Button size="sm" onClick={() => guard(openCreate)}>
          <Plus className="w-4 h-4 mr-1" />{t("master.prodLine.addLine")}
        </Button>
      </>
    );
  }, [onHeaderActions, fetchLines, openCreate, guard, loading, t]);

  // 작성 중(저장 안 됨) 여부 계산 후 보고 — 행 전환 시 유실 방어
  const dirty = useMemo(
    () => isPanelOpen && JSON.stringify(formData) !== JSON.stringify(initialFormRef.current),
    [isPanelOpen, formData],
  );
  useEffect(() => { markDirty(dirty); }, [dirty, markDirty]);

  const handleSave = useCallback(async () => {
    if (!formData.lineCode || !formData.lineName || !formData.lineType) return;
    setSaving(true);
    try {
      if (editingLine) {
        await api.put(`/master/prod-lines/${editingLine.lineCode}`, formData);
      } else {
        await api.post("/master/prod-lines", formData);
      }
      markDirty(false);
      setIsPanelOpen(false);
      fetchLines();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [formData, editingLine, fetchLines, markDirty]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/prod-lines/${deleteTarget.lineCode}`);
      setDeleteTarget(null);
      fetchLines();
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }, [deleteTarget, fetchLines]);

  const columns = useMemo<ColumnDef<ProdLine>[]>(() => [
    { id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); guard(() => openEdit(row.original)); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "lineCode", header: t("master.prodLine.lineCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "lineName", header: t("master.prodLine.lineName"), size: 200, meta: { filterType: "text" as const } },
    { accessorKey: "oper", header: t("master.prodLine.oper"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>,
    },
    { accessorKey: "lineType", header: t("master.prodLine.lineType"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">{v}</span> : <span className="text-text-muted">-</span>;
      },
    },
    { accessorKey: "whLoc", header: t("master.prodLine.whLoc"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "erpCode", header: t("master.prodLine.erpCode"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    { accessorKey: "remark", header: t("master.prodLine.remark"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    { accessorKey: "useYn", header: t("master.prodLine.use"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
  ], [t, openEdit, guard, handleDelete]);

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        <Card className="flex-1 min-h-0 overflow-hidden">
          <CardContent className="h-full">
            <DataGrid
        sqlQuery={`SELECT *\nFROM PROD_LINE_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}
              data={lines}
              columns={columns}
              isLoading={loading}
              enableColumnFilter
              enableExport
              exportFileName={t("master.prodLine.title", "생산라인")}
              onRowClick={(row) => { if (isPanelOpen) guard(() => openEdit(row)); }}
              toolbarLeft={
                <div className="flex gap-3 flex-1 min-w-0">
                  <div className="flex-1 min-w-0">
                    <Input placeholder={t("master.prodLine.searchPlaceholder")} value={searchText}
                      onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                  </div>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>

      {isPanelOpen && (
        <div className={`w-[440px] ml-4 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs ${panelAnimateRef.current ? "animate-slide-in-right" : ""}`}>
          <div className="px-5 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-bold text-text">
              {editingLine ? t("master.prodLine.editLine") : t("master.prodLine.addLine")}
            </h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => guard(() => setIsPanelOpen(false))}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !formData.lineCode || !formData.lineName || !formData.lineType}>
                {saving ? t("common.saving") : t("common.save", "저장")}
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput field="lineCode" label={t("master.prodLine.lineCode")} placeholder="P2001"
                value={formData.lineCode || ""} onChange={(e) => setFormData((p) => ({ ...p, lineCode: e.target.value }))}
                disabled={!!editingLine} />
              <FieldInput field="lineName" label={t("master.prodLine.lineName")} placeholder={t("master.prodLine.lineName")}
                value={formData.lineName || ""} onChange={(e) => setFormData((p) => ({ ...p, lineName: e.target.value }))} />
              <FieldInput field="oper" label={t("master.prodLine.oper")} placeholder="#0100"
                value={formData.oper || ""} onChange={(e) => setFormData((p) => ({ ...p, oper: e.target.value }))} />
              <FieldInput field="lineType" label={t("master.prodLine.lineType")} placeholder="PACKING"
                value={formData.lineType || ""} onChange={(e) => setFormData((p) => ({ ...p, lineType: e.target.value }))} required />
              <FieldInput field="whLoc" label={t("master.prodLine.whLoc")} placeholder="LOC002"
                value={formData.whLoc || ""} onChange={(e) => setFormData((p) => ({ ...p, whLoc: e.target.value }))} />
              <FieldInput field="erpCode" label={t("master.prodLine.erpCode")} placeholder="ERP Code"
                value={formData.erpCode || ""} onChange={(e) => setFormData((p) => ({ ...p, erpCode: e.target.value }))} />
              <FieldInput field="remark" label={t("master.prodLine.remark")} placeholder={t("master.prodLine.remark")}
                value={formData.remark || ""} onChange={(e) => setFormData((p) => ({ ...p, remark: e.target.value }))}
                wrapperClassName="col-span-2" />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t("common.delete")}
        message={`${deleteTarget?.lineCode ?? ""} (${deleteTarget?.lineName ?? ""}) ${t("common.deleteMessage", { defaultValue: "을(를) 삭제하시겠습니까?" })}`}
        confirmText={t("common.delete")}
        variant="danger"
      />
      <ConfirmModal {...guardModalProps} />
    </div>
  );
}
