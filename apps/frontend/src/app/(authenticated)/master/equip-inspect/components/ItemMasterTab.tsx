"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Edit2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { Button, ConfirmModal, Input, Modal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import api from "@/services/api";
import { InspectItemPoolRow, INSPECT_TYPE_COLORS } from "../types";

type InspectType = InspectItemPoolRow["inspectType"];

const EMPTY_FORM = {
  itemCode: "",
  itemName: "",
  inspectType: "DAILY" as InspectType,
  criteria: "",
  cycle: "DAILY",
  useYn: "Y",
  remark: "",
};

export default function ItemMasterTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InspectItemPoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InspectItemPoolRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InspectItemPoolRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.inspectType = typeFilter;
      const res = await api.get("/master/equip-inspect-item-pool", { params });
      setItems(res.data?.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const typeFilterOptions = useMemo(() => [
    { value: "", label: `${t("master.equipInspect.inspectType")}: ${t("common.all")}` },
    { value: "DAILY", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typeDaily")}` },
    { value: "PERIODIC", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePeriodic")}` },
    { value: "PM", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePM", "예방보전")}` },
    { value: "WORKER", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typeWorker", "작업자설비점검")}` },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
    { value: "PM", label: t("master.equipInspect.typePM", "예방보전") },
    { value: "WORKER", label: t("master.equipInspect.typeWorker", "작업자설비점검") },
  ], [t]);

  const cycleOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.cycleDaily") },
    { value: "WEEKLY", label: t("master.equipInspect.cycleWeekly") },
    { value: "MONTHLY", label: t("master.equipInspect.cycleMonthly") },
    { value: "QUARTERLY", label: t("master.equipInspect.cycleQuarterly", "분기") },
    { value: "SEMI_ANNUAL", label: t("master.equipInspect.cycleSemiAnnual", "반기") },
    { value: "ANNUAL", label: t("master.equipInspect.cycleAnnual", "연간") },
  ], [t]);

  const inspectTypeLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.typeDaily"),
    PERIODIC: t("master.equipInspect.typePeriodic"),
    PM: t("master.equipInspect.typePM", "예방보전"),
    WORKER: t("master.equipInspect.typeWorker", "작업자설비점검"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
    QUARTERLY: t("master.equipInspect.cycleQuarterly", "분기"),
    SEMI_ANNUAL: t("master.equipInspect.cycleSemiAnnual", "반기"),
    ANNUAL: t("master.equipInspect.cycleAnnual", "연간"),
  }), [t]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (item: InspectItemPoolRow) => {
    setEditing(item);
    setForm({
      itemCode: item.itemCode,
      itemName: item.itemName,
      inspectType: item.inspectType,
      criteria: item.criteria || "",
      cycle: item.cycle || "DAILY",
      useYn: item.useYn || "Y",
      remark: item.remark || "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.itemCode.trim() || !form.itemName.trim()) return;

    const payload = {
      itemCode: form.itemCode.trim(),
      itemName: form.itemName.trim(),
      inspectType: form.inspectType,
      criteria: form.criteria.trim() || null,
      cycle: form.cycle || null,
      useYn: form.useYn,
      remark: form.remark.trim() || null,
    };

    try {
      if (editing) {
        await api.put(`/master/equip-inspect-item-pool/${editing.itemCode}`, payload);
      } else {
        await api.post("/master/equip-inspect-item-pool", payload);
      }
      setModalOpen(false);
      fetchData();
    } catch {
      // Shared API layer handles toast/error display in this project.
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/equip-inspect-item-pool/${deleteTarget.itemCode}`);
      setDeleteTarget(null);
      fetchData();
    } catch {
      // Shared API layer handles toast/error display in this project.
    }
  };

  const columns: ColumnDef<InspectItemPoolRow>[] = useMemo(() => [
    {
      id: "actions",
      header: "",
      size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "itemCode",
      header: t("master.equipInspect.itemCode", "항목코드"),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 220, meta: { filterType: "text" as const } },
    {
      accessorKey: "inspectType",
      header: t("master.equipInspect.inspectType"),
      size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${INSPECT_TYPE_COLORS[type]}`}>{inspectTypeLabels[type]}</span>;
      },
    },
    { accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 220 },
    {
      accessorKey: "cycle",
      header: t("master.equipInspect.cycle"),
      size: 100,
      cell: ({ getValue }) => cycleLabels[getValue() as string] || getValue() || "-",
    },
    {
      accessorKey: "useYn",
      header: t("common.useYn", "사용"),
      size: 60,
      cell: ({ getValue }) => getValue() === "Y"
        ? <span className="text-green-600 dark:text-green-400 font-medium">Y</span>
        : <span className="text-red-500 font-medium">N</span>,
    },
  ], [t, inspectTypeLabels, cycleLabels]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center flex-shrink-0">
        <p className="text-sm text-text-muted">{t("master.equipInspect.itemMasterDesc", "점검항목 Pool을 관리합니다")}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />{t("common.register", "등록")}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <DataGrid
          data={items}
          columns={columns}
          isLoading={loading}
          enableColumnFilter
          enableExport
          exportFileName={t("master.equipInspect.tabMaster", "점검항목 마스터")}
          emptyMessage={t("master.equipInspect.noItems")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input
                  placeholder={t("master.equipInspect.searchPlaceholder")}
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  fullWidth
                />
              </div>
              <div className="w-44 flex-shrink-0">
                <Select options={typeFilterOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
            </div>
          }
        
        sqlQuery={`SELECT *\nFROM EQUIP_INSPECT_ITEM_POOL\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? t("master.equipInspect.editItem") : t("common.register", "등록")}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t("master.equipInspect.itemCode", "항목코드")}
              value={form.itemCode}
              onChange={e => setForm(prev => ({ ...prev, itemCode: e.target.value }))}
              disabled={!!editing}
              fullWidth
            />
            <Select
              label={t("master.equipInspect.inspectType")}
              options={typeOptions}
              value={form.inspectType}
              onChange={value => setForm(prev => ({ ...prev, inspectType: value as InspectType }))}
              fullWidth
            />
          </div>
          <Input
            label={t("master.equipInspect.itemName")}
            value={form.itemName}
            onChange={e => setForm(prev => ({ ...prev, itemName: e.target.value }))}
            fullWidth
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t("master.equipInspect.cycle")}
              options={cycleOptions}
              value={form.cycle}
              onChange={value => setForm(prev => ({ ...prev, cycle: value }))}
              fullWidth
            />
            <Select
              label={t("common.useYn", "사용")}
              options={[{ value: "Y", label: "Y" }, { value: "N", label: "N" }]}
              value={form.useYn}
              onChange={value => setForm(prev => ({ ...prev, useYn: value }))}
              fullWidth
            />
          </div>
          <Input
            label={t("master.equipInspect.criteria")}
            value={form.criteria}
            onChange={e => setForm(prev => ({ ...prev, criteria: e.target.value }))}
            fullWidth
          />
          <Input
            label={t("common.remark", "비고")}
            value={form.remark}
            onChange={e => setForm(prev => ({ ...prev, remark: e.target.value }))}
            fullWidth
          />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!form.itemCode.trim() || !form.itemName.trim()}>
            {editing ? t("common.save") : t("common.register", "등록")}
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={t("common.delete")}
        message={t("common.confirmDelete")}
      />
    </div>
  );
}
