"use client";

/**
 * @file src/app/(authenticated)/master/inspect-item/page.tsx
 * @description 점검항목 마스터 관리 페이지 - 공통 점검항목 풀 CRUD
 *
 * 초보자 가이드:
 * 1. **점검항목 목록**: DataGrid로 전체 점검항목 마스터 표시
 * 2. **판정방법**: VISUAL(육안)=판정기준 텍스트, MEASURE(계측)=기준값/상한/하한
 * 3. **CRUD**: 추가/수정/삭제 모달 처리
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, ClipboardCheck } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { InspectItemMaster, seedInspectItems, INSPECT_TYPE_COLORS } from "../equip-inspect/types";

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

export default function InspectItemPage() {
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
    if (!form.itemCode || !form.itemName) return;
    const data: InspectItemMaster = {
      id: editing?.id || `m${Date.now()}`,
      itemCode: form.itemCode, itemName: form.itemName, inspectType: form.inspectType,
      judgeMethod: form.judgeMethod, criteria: form.criteria, cycle: form.cycle,
      ...(form.judgeMethod === "MEASURE" ? {
        standardValue: form.standardValue ? Number(form.standardValue) : undefined,
        upperLimit: form.upperLimit ? Number(form.upperLimit) : undefined,
        lowerLimit: form.lowerLimit ? Number(form.lowerLimit) : undefined,
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

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  };

  /** 기준값 요약 표시 (DataGrid용) */
  const formatSpec = (item: InspectItemMaster) => {
    if (item.judgeMethod === "VISUAL") return "-";
    const parts: string[] = [];
    if (item.lowerLimit != null) parts.push(`${item.lowerLimit}`);
    if (item.standardValue != null) parts.push(`[${item.standardValue}]`);
    if (item.upperLimit != null) parts.push(`${item.upperLimit}`);
    const spec = parts.join(" ~ ");
    return item.unit ? `${spec} ${item.unit}` : spec;
  };

  const columns = useMemo<ColumnDef<InspectItemMaster>[]>(() => [
    { accessorKey: "itemCode", header: t("master.equipInspect.itemCode", "항목코드"), size: 90 },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 170 },
    {
      accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${INSPECT_TYPE_COLORS[v] || ""}`}>{inspectTypeLabels[v] || v}</span>;
      },
    },
    {
      accessorKey: "judgeMethod", header: t("master.inspectItem.judgeMethod", "판정방법"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const label = v === "MEASURE" ? t("master.inspectItem.measure", "계측") : t("master.inspectItem.visual", "육안");
        const color = v === "MEASURE" ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300" : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
        return <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>{label}</span>;
      },
    },
    { accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 140 },
    {
      id: "spec", header: t("master.inspectItem.spec", "기준값(하한~상한)"), size: 150,
      cell: ({ row }) => <span className="font-mono text-xs">{formatSpec(row.original)}</span>,
    },
    {
      accessorKey: "cycle", header: t("master.equipInspect.cycle"), size: 80,
      cell: ({ getValue }) => cycleLabels[getValue() as string] || getValue(),
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
  ], [t, inspectTypeLabels, cycleLabels]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-primary" />{t("master.inspectItem.title", "점검항목 마스터")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.inspectItem.subtitle", "설비 점검에 사용되는 공통 점검항목을 관리합니다")}</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />{t("master.inspectItem.addItem", "점검항목 추가")}
        </Button>
      </div>

      <Card>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input placeholder={t("master.equipInspect.searchPlaceholder")} value={searchText} onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
            </div>
            <Select options={typeOptions} value={typeFilter} onChange={setTypeFilter} />
          </div>
          <DataGrid data={filtered} columns={columns} pageSize={15} />
        </CardContent>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t("master.inspectItem.editItem", "점검항목 수정") : t("master.inspectItem.addItem", "점검항목 추가")} size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label={t("master.equipInspect.itemCode", "항목코드")} value={form.itemCode} onChange={e => setForm({ ...form, itemCode: e.target.value })} placeholder="CHK-001" fullWidth disabled={!!editing} />
          <Input label={t("master.equipInspect.itemName")} value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} placeholder="블레이드 마모 확인" fullWidth />
          <Select label={t("master.equipInspect.inspectType")} options={typeOptions.filter(o => o.value)} value={form.inspectType} onChange={v => setForm({ ...form, inspectType: v as "DAILY" | "PERIODIC" })} fullWidth />
          <Select label={t("master.equipInspect.cycle")} options={cycleOptions} value={form.cycle} onChange={v => setForm({ ...form, cycle: v })} fullWidth />
          <Select label={t("master.inspectItem.judgeMethod", "판정방법")} options={judgeMethodOptions} value={form.judgeMethod} onChange={v => setForm({ ...form, judgeMethod: v as "VISUAL" | "MEASURE" })} fullWidth />
          <Input label={t("master.equipInspect.criteria")} value={form.criteria} onChange={e => setForm({ ...form, criteria: e.target.value })} placeholder="판정기준 설명" fullWidth />
        </div>

        {form.judgeMethod === "MEASURE" && (
          <div className="grid grid-cols-4 gap-4 mt-4 p-4 bg-background rounded-lg border border-border">
            <Input label={t("master.inspectItem.standardValue", "기준값")} type="number" value={form.standardValue} onChange={e => setForm({ ...form, standardValue: e.target.value })} placeholder="0.6" fullWidth />
            <Input label={t("master.inspectItem.lowerLimit", "하한")} type="number" value={form.lowerLimit} onChange={e => setForm({ ...form, lowerLimit: e.target.value })} placeholder="0.5" fullWidth />
            <Input label={t("master.inspectItem.upperLimit", "상한")} type="number" value={form.upperLimit} onChange={e => setForm({ ...form, upperLimit: e.target.value })} placeholder="0.7" fullWidth />
            <Input label={t("master.inspectItem.unit", "단위")} value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="MPa" fullWidth />
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
