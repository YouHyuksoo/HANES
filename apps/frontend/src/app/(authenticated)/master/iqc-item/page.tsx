"use client";

/**
 * @file src/app/(authenticated)/master/iqc-item/page.tsx
 * @description IQC 검사항목 마스터 관리 - 독립적 검사항목 풀 CRUD
 *
 * 초보자 가이드:
 * 1. **검사항목 코드**: IQC-001 등 고유 코드로 관리
 * 2. **판정방법**: VISUAL(육안)/MEASURE(계측) - 계측은 LSL/USL 수치
 * 3. 품목 마스터에서 이 항목코드를 연결해서 사용
 */

import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, ClipboardCheck } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { IqcItemMaster, seedIqcItems, JUDGE_METHOD_COLORS } from "./types";

interface FormState {
  itemCode: string;
  itemName: string;
  judgeMethod: "VISUAL" | "MEASURE";
  criteria: string;
  lsl: string;
  usl: string;
  unit: string;
}

const EMPTY_FORM: FormState = {
  itemCode: "", itemName: "", judgeMethod: "VISUAL", criteria: "", lsl: "", usl: "", unit: "",
};

export default function IqcItemPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<IqcItemMaster[]>(seedIqcItems);
  const [searchText, setSearchText] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IqcItemMaster | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const methodOptions = useMemo(() => [
    { value: "", label: t("common.all") },
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
    return items.filter(item => {
      if (methodFilter && item.judgeMethod !== methodFilter) return false;
      if (searchText) {
        const s = searchText.toLowerCase();
        if (!item.itemCode.toLowerCase().includes(s) && !item.itemName.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [items, methodFilter, searchText]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalOpen(true); };

  const openEdit = (item: IqcItemMaster) => {
    setEditing(item);
    setForm({
      itemCode: item.itemCode, itemName: item.itemName, judgeMethod: item.judgeMethod,
      criteria: item.criteria, lsl: item.lsl?.toString() ?? "", usl: item.usl?.toString() ?? "",
      unit: item.unit ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!form.itemCode || !form.itemName) return;
    const data: IqcItemMaster = {
      id: editing?.id || `iq${Date.now()}`, itemCode: form.itemCode, itemName: form.itemName,
      judgeMethod: form.judgeMethod, criteria: form.criteria, useYn: "Y",
      ...(form.judgeMethod === "MEASURE" ? {
        lsl: form.lsl ? Number(form.lsl) : undefined,
        usl: form.usl ? Number(form.usl) : undefined,
        unit: form.unit || undefined,
      } : {}),
    };
    if (editing) {
      setItems(prev => prev.map(i => i.id === editing.id ? data : i));
    } else {
      setItems(prev => [...prev, data]);
    }
    setModalOpen(false);
  };

  const handleDelete = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const formatSpec = (item: IqcItemMaster) => {
    if (item.judgeMethod === "VISUAL") return "-";
    const parts: string[] = [];
    if (item.lsl != null) parts.push(`${item.lsl}`);
    if (item.usl != null) parts.push(`${item.usl}`);
    const spec = parts.join(" ~ ");
    return item.unit ? `${spec} ${item.unit}` : spec;
  };

  const columns = useMemo<ColumnDef<IqcItemMaster>[]>(() => [
    { accessorKey: "itemCode", header: t("master.iqcItem.itemCode", "항목코드"), size: 100 },
    { accessorKey: "itemName", header: t("master.iqcItem.inspectItem"), size: 160 },
    {
      accessorKey: "judgeMethod", header: t("master.iqcItem.judgeMethod", "판정방법"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${JUDGE_METHOD_COLORS[v]}`}>{methodLabels[v]}</span>;
      },
    },
    { accessorKey: "criteria", header: t("master.iqcItem.spec"), size: 160 },
    {
      id: "lslUsl", header: "LSL ~ USL", size: 140,
      cell: ({ row }) => <span className="font-mono text-xs">{formatSpec(row.original)}</span>,
    },
    {
      id: "actions", header: t("common.actions"), size: 70,
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => openEdit(row.original)} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
          <button onClick={() => handleDelete(row.original.id)} className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
        </div>
      ),
    },
  ], [t, methodLabels]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />{t("master.iqcItem.title")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.iqcItem.subtitle")}</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" />{t("master.iqcItem.addItem")}</Button>
      </div>

      <Card><CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <Input placeholder={t("master.iqcItem.searchPlaceholder")} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
          </div>
          <Select options={methodOptions} value={methodFilter} onChange={setMethodFilter} />
        </div>
        <DataGrid data={filtered} columns={columns} pageSize={15} />
      </CardContent></Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t("master.iqcItem.editItem") : t("master.iqcItem.addItem")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.iqcItem.itemCode", "항목코드")} value={form.itemCode} onChange={e => setForm({ ...form, itemCode: e.target.value })} placeholder="IQC-001" fullWidth disabled={!!editing} />
          <Input label={t("master.iqcItem.inspectItem")} value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} placeholder="외관검사" fullWidth />
          <Select label={t("master.iqcItem.judgeMethod", "판정방법")} options={judgeOptions} value={form.judgeMethod} onChange={v => setForm({ ...form, judgeMethod: v as "VISUAL" | "MEASURE" })} fullWidth />
          <Input label={t("master.iqcItem.spec")} value={form.criteria} onChange={e => setForm({ ...form, criteria: e.target.value })} placeholder="규격 이내" fullWidth />
        </div>
        {form.judgeMethod === "MEASURE" && (
          <div className="grid grid-cols-3 gap-4 mt-4 p-4 bg-background rounded-lg border border-border">
            <Input label="LSL" type="number" value={form.lsl} onChange={e => setForm({ ...form, lsl: e.target.value })} placeholder="0.4" fullWidth />
            <Input label="USL" type="number" value={form.usl} onChange={e => setForm({ ...form, usl: e.target.value })} placeholder="0.6" fullWidth />
            <Input label={t("common.unit")} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="mm" fullWidth />
          </div>
        )}
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave}>{editing ? t("common.edit") : t("common.add")}</Button>
        </div>
      </Modal>
    </div>
  );
}
