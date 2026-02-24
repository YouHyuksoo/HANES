"use client";

/**
 * @file components/master/ProcessTab.tsx
 * @description 공정관리 탭 - Oracle API 연동 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/processes
 * 2. DataGrid로 공정 목록 표시 + 모달로 등록/수정
 * 3. 공정유형 필터링 + 검색 지원
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ComCodeBadge } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface Process {
  id: string;
  processCode: string;
  processName: string;
  processType: string;
  processCategory?: string;
  sampleInspectYn: string;
  sortOrder: number;
  remark?: string;
  useYn: string;
}

export default function ProcessTab() {
  const { t } = useTranslation();
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Process | null>(null);
  const [formData, setFormData] = useState<Partial<Process>>({});
  const [saving, setSaving] = useState(false);

  const processTypeOptions = useComCodeOptions("PROCESS_TYPE");
  const filterOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    ...processTypeOptions,
  ], [t, processTypeOptions]);

  const fetchProcesses = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.processType = typeFilter;
      const res = await api.get("/master/processes", { params });
      if (res.data.success) setProcesses(res.data.data || []);
    } catch {
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter]);

  useEffect(() => { fetchProcesses(); }, [fetchProcesses]);

  const processCategoryOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "ASSY", label: t("master.process.catAssy") },
    { value: "INSP", label: t("master.process.catInsp") },
    { value: "CUTTING", label: t("master.process.catCutting") },
    { value: "WELDING", label: t("master.process.catWelding") },
    { value: "PACKING", label: t("master.process.catPacking") },
  ], [t]);

  const openCreateModal = useCallback(() => {
    setEditingItem(null);
    setFormData({ useYn: "Y", sampleInspectYn: "N", sortOrder: 0 });
    setIsModalOpen(true);
  }, []);

  const openEditModal = useCallback((item: Process) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.processCode || !formData.processName || !formData.processType) return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/master/processes/${editingItem.id}`, formData);
      } else {
        await api.post("/master/processes", formData);
      }
      setIsModalOpen(false);
      fetchProcesses();
    } catch (e: any) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [formData, editingItem, fetchProcesses]);

  const handleDelete = useCallback(async (item: Process) => {
    try {
      await api.delete(`/master/processes/${item.id}`);
      fetchProcesses();
    } catch (e: any) {
      console.error("Delete failed:", e);
    }
  }, [fetchProcesses]);

  const columns = useMemo<ColumnDef<Process>[]>(() => [
    { accessorKey: "processCode", header: t("master.process.processCode"), size: 120 },
    { accessorKey: "processName", header: t("master.process.processName"), size: 160 },
    { accessorKey: "processType", header: t("master.process.processType"), size: 100,
      cell: ({ getValue }) => <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />,
    },
    { accessorKey: "processCategory", header: t("master.process.processCategory"), size: 90,
      meta: { filterType: "multi" as const, filterOptions: processCategoryOptions.filter(o => o.value) },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">{v}</span> : "-";
      },
    },
    { accessorKey: "sampleInspectYn", header: t("master.process.sampleInspectYn"), size: 80,
      meta: { filterType: "multi" as const, filterOptions: [{ value: "Y", label: "Y" }, { value: "N", label: "N" }] },
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-orange-500" : "bg-gray-300"}`} />
      ),
    },
    { accessorKey: "sortOrder", header: t("master.process.sortOrder"), size: 80 },
    { accessorKey: "remark", header: t("common.remark"), size: 150,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    { accessorKey: "useYn", header: t("master.process.use"), size: 60,
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
    { id: "actions", header: t("common.actions"), size: 80,
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
            data={processes}
            columns={columns}
            isLoading={loading}
            enableColumnFilter
            enableExport
            exportFileName={t("master.process.title")}
            toolbarLeft={
              <div className="flex gap-3 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <Input placeholder={t("master.process.searchPlaceholder")} value={searchText}
                    onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
                </div>
                <div className="w-40 flex-shrink-0">
                  <Select options={filterOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
                </div>
                <Button variant="secondary" size="sm" onClick={fetchProcesses} className="flex-shrink-0">
                  <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
                </Button>
                <Button size="sm" onClick={openCreateModal} className="flex-shrink-0">
                  <Plus className="w-4 h-4 mr-1" />{t("master.process.addProcess")}
                </Button>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingItem ? t("master.process.editProcess") : t("master.process.addProcess")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.process.processCode")} placeholder="CUT-01"
            value={formData.processCode || ""} onChange={(e) => setFormData((p) => ({ ...p, processCode: e.target.value }))}
            disabled={!!editingItem} fullWidth />
          <Select label={t("master.process.processType")} options={processTypeOptions}
            value={formData.processType || ""} onChange={(v) => setFormData((p) => ({ ...p, processType: v }))} fullWidth />
          <div className="col-span-2">
            <Input label={t("master.process.processName")} placeholder={t("master.process.processName")}
              value={formData.processName || ""} onChange={(e) => setFormData((p) => ({ ...p, processName: e.target.value }))} fullWidth />
          </div>
          <Select label={t("master.process.processCategory")} options={processCategoryOptions.filter(o => o.value)}
            value={formData.processCategory || ""} onChange={(v) => setFormData((p) => ({ ...p, processCategory: v }))} fullWidth />
          <Select label={t("master.process.sampleInspectYn")}
            options={[{ value: "Y", label: "Y" }, { value: "N", label: "N" }]}
            value={formData.sampleInspectYn || "N"} onChange={(v) => setFormData((p) => ({ ...p, sampleInspectYn: v }))} fullWidth />
          <Input label={t("master.process.sortOrder")} type="number" placeholder="0"
            value={formData.sortOrder?.toString() || "0"} onChange={(e) => setFormData((p) => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))} fullWidth />
          <Input label={t("common.remark")} placeholder={t("common.remark")}
            value={formData.remark || ""} onChange={(e) => setFormData((p) => ({ ...p, remark: e.target.value }))} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : editingItem ? t("common.edit") : t("common.add")}
          </Button>
        </div>
      </Modal>
    </>
  );
}
