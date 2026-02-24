"use client";

/**
 * @file components/master/ProdLineTab.tsx
 * @description 생산라인 탭 - Oracle API 연동 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/prod-lines
 * 2. DataGrid로 목록 표시 + 모달로 등록/수정
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface ProdLine {
  id: string;
  lineCode: string;
  lineName: string;
  whLoc?: string;
  erpCode?: string;
  oper?: string;
  lineType?: string;
  remark?: string;
  useYn: string;
}

export default function ProdLineTab() {
  const { t } = useTranslation();
  const [lines, setLines] = useState<ProdLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProdLine | null>(null);
  const [formData, setFormData] = useState<Partial<ProdLine>>({});
  const [saving, setSaving] = useState(false);

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

  const openCreateModal = useCallback(() => {
    setEditingLine(null);
    setFormData({ useYn: "Y" });
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((line: ProdLine) => {
    setEditingLine(line);
    setFormData({ ...line });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.lineCode || !formData.lineName) return;
    setSaving(true);
    try {
      if (editingLine) {
        await api.put(`/master/prod-lines/${editingLine.id}`, formData);
      } else {
        await api.post("/master/prod-lines", formData);
      }
      setIsModalOpen(false);
      fetchLines();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [formData, editingLine, fetchLines]);

  const handleDelete = useCallback(async (line: ProdLine) => {
    try {
      await api.delete(`/master/prod-lines/${line.id}`);
      fetchLines();
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }, [fetchLines]);

  const columns = useMemo<ColumnDef<ProdLine>[]>(() => [
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
    { id: "actions", header: t("common.actions"), size: 80,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEditModal(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t, openEditModal, handleDelete]);

  return (
    <>
      <Card>
        <CardContent>
          <DataGrid
            data={lines}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("master.prodLine.title", "생산라인")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.prodLine.searchPlaceholder")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchLines} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
                </Button>
                <Button size="sm" onClick={openCreateModal} className="flex-shrink-0">
                  <Plus className="w-4 h-4 mr-1" />{t("master.prodLine.addLine")}
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingLine ? t("master.prodLine.editLine") : t("master.prodLine.addLine")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.prodLine.lineCode")} placeholder="P2001"
            value={formData.lineCode || ""} onChange={(e) => setFormData((p) => ({ ...p, lineCode: e.target.value }))}
            disabled={!!editingLine} fullWidth />
          <Input label={t("master.prodLine.lineName")} placeholder={t("master.prodLine.lineName")}
            value={formData.lineName || ""} onChange={(e) => setFormData((p) => ({ ...p, lineName: e.target.value }))} fullWidth />
          <Input label={t("master.prodLine.oper")} placeholder="#0100"
            value={formData.oper || ""} onChange={(e) => setFormData((p) => ({ ...p, oper: e.target.value }))} fullWidth />
          <Input label={t("master.prodLine.lineType")} placeholder="PACKING"
            value={formData.lineType || ""} onChange={(e) => setFormData((p) => ({ ...p, lineType: e.target.value }))} fullWidth />
          <Input label={t("master.prodLine.whLoc")} placeholder="LOC002"
            value={formData.whLoc || ""} onChange={(e) => setFormData((p) => ({ ...p, whLoc: e.target.value }))} fullWidth />
          <Input label={t("master.prodLine.erpCode")} placeholder="ERP Code"
            value={formData.erpCode || ""} onChange={(e) => setFormData((p) => ({ ...p, erpCode: e.target.value }))} fullWidth />
          <div className="col-span-2">
            <Input label={t("master.prodLine.remark")} placeholder={t("master.prodLine.remark")}
              value={formData.remark || ""} onChange={(e) => setFormData((p) => ({ ...p, remark: e.target.value }))} fullWidth />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : editingLine ? t("common.edit") : t("common.add")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
