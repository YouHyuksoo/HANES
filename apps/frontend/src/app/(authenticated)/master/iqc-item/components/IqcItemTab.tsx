"use client";

/**
 * @file components/IqcItemTab.tsx
 * @description IQC 검사항목 풀 관리 탭 — API 연동 CRUD
 *
 * 초보자 가이드:
 * 1. API: GET/POST/PUT/DELETE /master/iqc-item-pool
 * 2. 항목코드(IQC-xxx) + 판정방법(육안/계측) 관리
 * 3. 계측 항목은 단위(unit) 입력 가능
 * 4. LSL/USL/규격은 품목별 IQC 기준 탭에서 설정
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { JUDGE_METHOD_COLORS } from "../types";
import api from "@/services/api";

interface IqcItemPool {
  id: string;
  inspItemCode: string;
  inspItemName: string;
  judgeMethod: "VISUAL" | "MEASURE";
  unit: string | null;
  useYn: string;
}

interface FormState {
  itemCode: string;
  itemName: string;
  judgeMethod: "VISUAL" | "MEASURE";
  unit: string;
}

const EMPTY_FORM: FormState = {
  itemCode: "", itemName: "", judgeMethod: "VISUAL", unit: "",
};

export default function IqcItemTab() {
  const { t } = useTranslation();
  const [data, setData] = useState<IqcItemPool[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IqcItemPool | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; itemCode: string }>({ open: false, itemCode: "" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (methodFilter) params.judgeMethod = methodFilter;
      const res = await api.get("/master/iqc-item-pool", { params });
      setData(res.data?.data ?? []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [methodFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const methodOptions = useMemo(() => [
    { value: "", label: t("master.iqcItem.judgeMethod", "판정방법") },
    { value: "VISUAL", label: t("master.iqcItem.visual", "육안") },
    { value: "MEASURE", label: t("master.iqcItem.measureMethod", "계측") },
  ], [t]);

  const judgeOptions = useMemo(() => [
    { value: "VISUAL", label: t("master.iqcItem.visual", "육안") },
    { value: "MEASURE", label: t("master.iqcItem.measureMethod", "계측") },
  ], [t]);

  const methodLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.iqcItem.visual", "육안"),
    MEASURE: t("master.iqcItem.measureMethod", "계측"),
  }), [t]);

  const filtered = useMemo(() => {
    if (!searchText) return data;
    const s = searchText.toLowerCase();
    return data.filter(item =>
      item.inspItemCode.toLowerCase().includes(s) ||
      item.inspItemName.toLowerCase().includes(s)
    );
  }, [data, searchText]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item: IqcItemPool) => {
    setEditing(item);
    setForm({
      itemCode: item.inspItemCode,
      itemName: item.inspItemName,
      judgeMethod: item.judgeMethod,
      unit: item.unit ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.itemCode || !form.itemName) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        inspItemCode: form.itemCode,
        inspItemName: form.itemName,
        judgeMethod: form.judgeMethod,
        unit: form.unit || undefined,
      };

      if (editing) {
        await api.put(`/master/iqc-item-pool/${editing.inspItemCode}`, payload);
      } else {
        await api.post("/master/iqc-item-pool", payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  }, [editing, form, fetchData]);

  const handleDelete = useCallback(async () => {
    try {
      await api.delete(`/master/iqc-item-pool/${confirmModal.itemCode}`);
      setConfirmModal({ open: false, itemCode: "" });
      fetchData();
    } catch (e) {
      console.error("Delete failed:", e);
    }
  }, [confirmModal.itemCode, fetchData]);

  const columns = useMemo<ColumnDef<IqcItemPool>[]>(() => [
    {
      id: "actions", header: "", size: 70,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button
            onClick={() => setConfirmModal({ open: true, itemCode: row.original.inspItemCode })}
            className="p-1 hover:bg-surface rounded"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "inspItemCode", header: t("master.iqcItem.itemCode", "항목코드"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "inspItemName", header: t("master.iqcItem.inspectItem"), size: 200, meta: { filterType: "text" as const } },
    {
      accessorKey: "judgeMethod", header: t("master.iqcItem.judgeMethod", "판정방법"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${JUDGE_METHOD_COLORS[v]}`}>{methodLabels[v]}</span>;
      },
    },
    { accessorKey: "unit", header: t("common.unit", "단위"), size: 80, meta: { filterType: "text" as const } },
  ], [t, methodLabels]);

  return (
    <>
      <Card><CardContent>
        <DataGrid
          data={filtered}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("master.iqcItem.tabItems", "검사항목")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t("master.iqcItem.searchPlaceholder")}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-36 flex-shrink-0">
                <Select options={methodOptions} value={methodFilter} onChange={setMethodFilter} fullWidth />
              </div>
              <Button variant="secondary" size="sm" onClick={fetchData} className="flex-shrink-0">
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
              </Button>
              <Button size="sm" onClick={openCreate} className="flex-shrink-0">
                <Plus className="w-4 h-4 mr-1" />{t("master.iqcItem.addItem")}
              </Button>
            </div>
          }
        />
      </CardContent></Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("master.iqcItem.editItem") : t("master.iqcItem.addItem")}
        size="md"
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t("master.iqcItem.itemCode", "항목코드")}
            value={form.itemCode}
            onChange={e => setForm({ ...form, itemCode: e.target.value })}
            fullWidth
            disabled={!!editing}
          />
          <Input
            label={t("master.iqcItem.inspectItem")}
            value={form.itemName}
            onChange={e => setForm({ ...form, itemName: e.target.value })}
            fullWidth
          />
          <Select
            label={t("master.iqcItem.judgeMethod", "판정방법")}
            options={judgeOptions}
            value={form.judgeMethod}
            onChange={v => setForm({ ...form, judgeMethod: v as "VISUAL" | "MEASURE" })}
            fullWidth
          />
          <Input
            label={t("common.unit", "단위")}
            value={form.unit}
            onChange={e => setForm({ ...form, unit: e.target.value })}
            fullWidth
          />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : editing ? t("common.edit") : t("common.add")}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, itemCode: "" })}
        onConfirm={handleDelete}
        title={t("master.iqcItem.deleteItem", "검사항목 삭제")}
        message={t("master.iqcItem.deleteConfirm", "이 검사항목을 삭제하시겠습니까?")}
        variant="danger"
      />
    </>
  );
}
