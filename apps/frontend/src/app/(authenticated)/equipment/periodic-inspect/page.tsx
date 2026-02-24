"use client";

/**
 * @file src/app/(authenticated)/equipment/periodic-inspect/page.tsx
 * @description 설비 정기점검 페이지 - 주기적으로 수행하는 설비 점검 결과 CRUD
 *
 * 초보자 가이드:
 * 1. **정기점검**: 주간/월간/분기 등 주기적으로 수행하는 심층 점검
 * 2. **결과**: PASS(합격), FAIL(불합격), CONDITIONAL(조건부)
 * 3. API: GET/POST/PUT/DELETE /equipment/periodic-inspect (inspectType=PERIODIC)
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  CalendarCheck, Plus, Search, RefreshCw, Edit2, Trash2,
  CheckCircle, XCircle, AlertTriangle, Shield,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";

interface PeriodicInspect {
  id: string;
  equipCode: string;
  equipName: string;
  inspectDate: string;
  inspectorName: string;
  overallResult: string;
  remark: string;
}

const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  CONDITIONAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function PeriodicInspectPage() {
  const { t } = useTranslation();

  const [data, setData] = useState<PeriodicInspect[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PeriodicInspect | null>(null);
  const [form, setForm] = useState({
    equipId: "", inspectDate: "", inspectorName: "", overallResult: "PASS", remark: "",
  });
  const [deleteTarget, setDeleteTarget] = useState<PeriodicInspect | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (resultFilter) params.overallResult = resultFilter;
      if (dateFilter) params.inspectDateFrom = dateFilter;
      const res = await api.get("/equipment/periodic-inspect", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, resultFilter, dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resultOptions = useMemo(() => [
    { value: "", label: t("equipment.periodicInspect.allResult") },
    { value: "PASS", label: t("equipment.periodicInspect.resultPass") },
    { value: "FAIL", label: t("equipment.periodicInspect.resultFail") },
    { value: "CONDITIONAL", label: t("equipment.periodicInspect.resultConditional") },
  ], [t]);

  const stats = useMemo(() => ({
    total: data.length,
    pass: data.filter(d => d.overallResult === "PASS").length,
    fail: data.filter(d => d.overallResult === "FAIL").length,
    conditional: data.filter(d => d.overallResult === "CONDITIONAL").length,
  }), [data]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ equipId: "", inspectDate: new Date().toISOString().split("T")[0], inspectorName: "", overallResult: "PASS", remark: "" });
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((item: PeriodicInspect) => {
    setEditingItem(item);
    setForm({ equipId: item.id, inspectDate: item.inspectDate, inspectorName: item.inspectorName, overallResult: item.overallResult, remark: item.remark });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.equipId || !form.inspectDate) return;
    setSaving(true);
    try {
      if (editingItem) {
        await api.put(`/equipment/periodic-inspect/${editingItem.id}`, form);
      } else {
        await api.post("/equipment/periodic-inspect", { ...form, inspectType: "PERIODIC" });
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
      await api.delete(`/equipment/periodic-inspect/${deleteTarget.id}`);
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleteTarget(null);
    }
  }, [deleteTarget, fetchData]);

  const columns = useMemo<ColumnDef<PeriodicInspect>[]>(() => [
    { accessorKey: "inspectDate", header: t("equipment.periodicInspect.inspectDate"), size: 110, meta: { filterType: "date" as const } },
    {
      accessorKey: "equipCode", header: t("equipment.periodicInspect.equipCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "equipName", header: t("equipment.periodicInspect.equipName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "inspectorName", header: t("equipment.periodicInspect.inspector"), size: 90,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "overallResult", header: t("equipment.periodicInspect.result"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const r = getValue() as string;
        const label = r === "PASS" ? t("equipment.periodicInspect.resultPass")
          : r === "FAIL" ? t("equipment.periodicInspect.resultFail")
          : t("equipment.periodicInspect.resultConditional");
        return <span className={`px-2 py-0.5 text-xs rounded font-medium ${resultColors[r] || ""}`}>{label}</span>;
      },
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 180,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      id: "actions", header: "", size: 80,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t, openEdit]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-primary" />{t("equipment.periodicInspect.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("equipment.periodicInspect.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1" />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />{t("common.register")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("equipment.periodicInspect.statTotal")} value={stats.total} icon={Shield} color="blue" />
        <StatCard label={t("equipment.periodicInspect.resultPass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.periodicInspect.resultFail")} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t("equipment.periodicInspect.resultConditional")} value={stats.conditional} icon={AlertTriangle} color="yellow" />
      </div>

      <Card><CardContent>
        <DataGrid data={data} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={t("equipment.periodicInspect.title")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("equipment.periodicInspect.searchPlaceholder")}
                  value={searchText} onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth />
              </div>
              <div className="w-36 flex-shrink-0">
                <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
        title={editingItem ? t("equipment.periodicInspect.editTitle") : t("equipment.periodicInspect.addTitle")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("equipment.periodicInspect.equipCode")} placeholder="CUT-001"
              value={form.equipId} onChange={e => setForm(p => ({ ...p, equipId: e.target.value }))} fullWidth />
            <Input label={t("equipment.periodicInspect.inspectDate")} type="date"
              value={form.inspectDate} onChange={e => setForm(p => ({ ...p, inspectDate: e.target.value }))} fullWidth />
            <Input label={t("equipment.periodicInspect.inspector")} placeholder={t("equipment.periodicInspect.inspectorPlaceholder")}
              value={form.inspectorName} onChange={e => setForm(p => ({ ...p, inspectorName: e.target.value }))} fullWidth />
            <Select label={t("equipment.periodicInspect.overallResult")} options={resultOptions.slice(1)}
              value={form.overallResult} onChange={v => setForm(p => ({ ...p, overallResult: v }))} fullWidth />
          </div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")}
            value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave} disabled={saving || !form.equipId || !form.inspectDate}>
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
        message={`'${deleteTarget?.equipName || ""}'을(를) 삭제하시겠습니까?`}
      />
    </div>
  );
}
