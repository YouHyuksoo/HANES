"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/ItemMasterTab.tsx
 * @description 점검항목 마스터 탭 - 공통 점검항목 풀 CRUD
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import { Button, Input, Modal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { InspectItemMaster, seedInspectItems, INSPECT_TYPE_COLORS } from "../types";

interface FormState {
  itemCode: string;
  itemName: string;
  inspectType: "DAILY" | "PERIODIC";
  judgeMethod: "VISUAL" | "MEASURE";
  criteria: string;
  standardValue: string;
  upperLimit: string;
  lowerLimit: string;
  unit: string;
  cycle: string;
}

const emptyForm: FormState = {
  itemCode: "", itemName: "", inspectType: "DAILY", judgeMethod: "VISUAL",
  criteria: "", standardValue: "", upperLimit: "", lowerLimit: "", unit: "", cycle: "DAILY",
};

export default function ItemMasterTab() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InspectItemMaster[]>(seedInspectItems);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InspectItemMaster | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const typeOptions = useMemo(() => [
    { value: "", label: t("common.all") },
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
  ], [t]);

  const cycleOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.cycleDaily") },
    { value: "WEEKLY", label: t("master.equipInspect.cycleWeekly") },
    { value: "MONTHLY", label: t("master.equipInspect.cycleMonthly") },
  ], [t]);

  const judgeMethodOptions = useMemo(() => [
    { value: "VISUAL", label: t("master.inspectItem.visual", "육안") },
    { value: "MEASURE", label: t("master.inspectItem.measure", "계측") },
  ], [t]);

  const inspectTypeLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.typeDaily"), PERIODIC: t("master.equipInspect.typePeriodic"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"), WEEKLY: t("master.equipInspect.cycleWeekly"), MONTHLY: t("master.equipInspect.cycleMonthly"),
  }), [t]);

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (typeFilter && item.inspectType !== typeFilter) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!item.itemCode.toLowerCase().includes(s) && !item.itemName.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, typeFilter, searchText]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (item: InspectItemMaster) => {
    setEditing(item);
    setForm({
      itemCode: item.itemCode, itemName: item.itemName, inspectType: item.inspectType,
      judgeMethod: item.judgeMethod, criteria: item.criteria,
      standardValue: item.standardValue?.toString() ?? "",
      upperLimit: item.upperLimit?.toString() ?? "",
      lowerLimit: item.lowerLimit?.toString() ?? "",
      unit: item.unit ?? "", cycle: item.cycle,
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (editing) {
      setItems(prev => prev.map(i => i.id === editing.id ? {
        ...i, ...form,
        standardValue: form.standardValue ? parseFloat(form.standardValue) : undefined,
        upperLimit: form.upperLimit ? parseFloat(form.upperLimit) : undefined,
        lowerLimit: form.lowerLimit ? parseFloat(form.lowerLimit) : undefined,
      } : i));
    } else {
      const newItem: InspectItemMaster = {
        id: `item-${Date.now()}`, ...form,
        standardValue: form.standardValue ? parseFloat(form.standardValue) : undefined,
        upperLimit: form.upperLimit ? parseFloat(form.upperLimit) : undefined,
        lowerLimit: form.lowerLimit ? parseFloat(form.lowerLimit) : undefined,
      };
      setItems(prev => [...prev, newItem]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(t("common.confirmDelete"))) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const columns: ColumnDef<InspectItemMaster>[] = useMemo(() => [
    { accessorKey: "itemCode", header: t("master.equipInspect.itemCode"), size: 120 },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 180 },
    {
      accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 100,
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${INSPECT_TYPE_COLORS[type]}`}>{inspectTypeLabels[type]}</span>;
      },
    },
    {
      accessorKey: "judgeMethod", header: t("master.equipInspect.judgeMethod"), size: 80,
      cell: ({ getValue }) => getValue() === "VISUAL" ? t("master.inspectItem.visual") : t("master.inspectItem.measure"),
    },
    {
      accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 150,
      cell: ({ row }) => row.original.judgeMethod === "VISUAL" ? row.original.criteria : "-",
    },
    {
      id: "measureValues", header: t("master.equipInspect.measureValues", "기준값/상한/하한"), size: 150,
      cell: ({ row }) => {
        if (row.original.judgeMethod !== "MEASURE") return "-";
        const { standardValue, upperLimit, lowerLimit, unit } = row.original;
        return <span className="text-xs">{standardValue}/{upperLimit}/{lowerLimit} {unit}</span>;
      },
    },
    {
      accessorKey: "cycle", header: t("master.equipInspect.cycle"), size: 80,
      cell: ({ getValue }) => cycleLabels[getValue() as string] || getValue(),
    },
    {
      id: "actions", header: "", size: 80,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => handleDelete(row.original.id)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
  ], [t, inspectTypeLabels, cycleLabels]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-text-muted">{t("master.equipInspect.itemMasterDesc", "점검항목 Pool을 관리합니다")}</p>
        <Button onClick={openCreate}><Plus className="w-4 h-4 mr-1" />{t("master.equipInspect.addItem")}</Button>
      </div>

      <div className="flex gap-4">
        <Input placeholder={t("master.equipInspect.searchPlaceholder")} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} className="flex-1" />
        <Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} placeholder={t("master.equipInspect.filterByType")} />
      </div>

      <DataGrid data={filtered} columns={columns} pageSize={10} emptyMessage={t("master.equipInspect.noItems")} />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t("master.equipInspect.editItem") : t("master.equipInspect.addItem")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("master.equipInspect.itemCode")} value={form.itemCode} onChange={e => setForm({ ...form, itemCode: e.target.value })} disabled={!!editing} fullWidth />
            <Input label={t("master.equipInspect.itemName")} value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} fullWidth />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t("master.equipInspect.inspectType")} options={typeOptions.filter(o => o.value)} value={form.inspectType} onChange={v => setForm({ ...form, inspectType: v as any })} />
            <Select label={t("master.equipInspect.cycle")} options={cycleOptions} value={form.cycle} onChange={v => setForm({ ...form, cycle: v })} />
          </div>
          <Select label={t("master.equipInspect.judgeMethod")} options={judgeMethodOptions} value={form.judgeMethod} onChange={v => setForm({ ...form, judgeMethod: v as any })} />
          {form.judgeMethod === "VISUAL" ? (
            <Input label={t("master.equipInspect.criteria")} value={form.criteria} onChange={e => setForm({ ...form, criteria: e.target.value })} fullWidth />
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <Input label={t("master.equipInspect.standardValue")} type="number" value={form.standardValue} onChange={e => setForm({ ...form, standardValue: e.target.value })} fullWidth />
              <Input label={t("master.equipInspect.upperLimit")} type="number" value={form.upperLimit} onChange={e => setForm({ ...form, upperLimit: e.target.value })} fullWidth />
              <Input label={t("master.equipInspect.lowerLimit")} type="number" value={form.lowerLimit} onChange={e => setForm({ ...form, lowerLimit: e.target.value })} fullWidth />
              <Input label={t("master.equipInspect.unit")} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} fullWidth />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave}>{editing ? t("common.edit") : t("common.add")}</Button>
        </div>
      </Modal>
    </div>
  );
}
