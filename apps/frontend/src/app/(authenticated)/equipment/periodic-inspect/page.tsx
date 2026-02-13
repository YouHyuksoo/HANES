"use client";

/**
 * @file src/app/(authenticated)/equipment/periodic-inspect/page.tsx
 * @description 설비 정기점검 페이지 - 주기적으로 수행하는 설비 점검 결과 CRUD
 *
 * 초보자 가이드:
 * 1. **정기점검**: 주간/월간/분기 등 주기적으로 수행하는 심층 점검
 * 2. **결과**: PASS(합격), FAIL(불합격), CONDITIONAL(조건부)
 * 3. inspectType="PERIODIC" 고정
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  CalendarCheck, Plus, Search, RefreshCw, Edit2, Trash2,
  CheckCircle, XCircle, AlertTriangle, Shield,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";

interface PeriodicInspect {
  id: string;
  equipCode: string;
  equipName: string;
  inspectDate: string;
  inspectorName: string;
  overallResult: string;
  remark: string;
}

const resultKeys: Record<string, string> = { PASS: "equipment.periodicInspect.resultPass", FAIL: "equipment.periodicInspect.resultFail", CONDITIONAL: "equipment.periodicInspect.resultConditional" };
const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  CONDITIONAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

const mockData: PeriodicInspect[] = [
  { id: "1", equipCode: "CUT-001", equipName: "절단기 1호", inspectDate: "2025-01-15", inspectorName: "김정비", overallResult: "PASS", remark: "월간 정기점검" },
  { id: "2", equipCode: "CRM-001", equipName: "압착기 1호", inspectDate: "2025-01-15", inspectorName: "이정비", overallResult: "CONDITIONAL", remark: "실린더 마모 감지" },
  { id: "3", equipCode: "ASM-001", equipName: "조립기 1호", inspectDate: "2025-01-10", inspectorName: "박정비", overallResult: "PASS", remark: "분기 정기점검" },
  { id: "4", equipCode: "INS-001", equipName: "검사기 1호", inspectDate: "2025-01-10", inspectorName: "김정비", overallResult: "FAIL", remark: "센서 교정 필요" },
];

function PeriodicInspectPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PeriodicInspect | null>(null);

  const resultOptions = [
    { value: "", label: t("equipment.periodicInspect.allResult") },
    { value: "PASS", label: t("equipment.periodicInspect.resultPass") }, { value: "FAIL", label: t("equipment.periodicInspect.resultFail") }, { value: "CONDITIONAL", label: t("equipment.periodicInspect.resultConditional") },
  ];

  const filteredData = useMemo(() => mockData.filter((item) => {
    const matchSearch = !searchText || item.equipCode.toLowerCase().includes(searchText.toLowerCase()) || item.equipName.toLowerCase().includes(searchText.toLowerCase());
    return matchSearch && (!resultFilter || item.overallResult === resultFilter) && (!dateFilter || item.inspectDate === dateFilter);
  }), [searchText, resultFilter, dateFilter]);

  const stats = useMemo(() => ({
    total: mockData.length, pass: mockData.filter((d) => d.overallResult === "PASS").length,
    fail: mockData.filter((d) => d.overallResult === "FAIL").length,
    conditional: mockData.filter((d) => d.overallResult === "CONDITIONAL").length,
  }), []);

  const columns = useMemo<ColumnDef<PeriodicInspect>[]>(() => [
    { accessorKey: "inspectDate", header: t("equipment.periodicInspect.inspectDate"), size: 100 },
    { accessorKey: "equipCode", header: t("equipment.periodicInspect.equipCode"), size: 100 },
    { accessorKey: "equipName", header: t("equipment.periodicInspect.equipName"), size: 120 },
    { accessorKey: "inspectorName", header: t("equipment.periodicInspect.inspector"), size: 80 },
    { accessorKey: "overallResult", header: t("equipment.periodicInspect.result"), size: 80, cell: ({ getValue }) => { const r = getValue() as string; return <span className={`px-2 py-0.5 text-xs rounded-full ${resultColors[r] || ""}`}>{t(resultKeys[r])}</span>; } },
    { accessorKey: "remark", header: t("common.remark"), size: 180 },
    { id: "actions", header: t("common.actions"), size: 80, cell: ({ row }) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditingItem(row.original); setIsModalOpen(true); }} className="p-1 hover:bg-surface rounded"><Edit2 className="w-4 h-4 text-primary" /></button>
        <button className="p-1 hover:bg-surface rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>
      </div>
    ) },
  ], [t]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><CalendarCheck className="w-7 h-7 text-primary" />{t("equipment.periodicInspect.title")}</h1>
          <p className="text-text-muted mt-1">{t("equipment.periodicInspect.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("equipment.periodicInspect.statTotal")} value={stats.total} icon={Shield} color="blue" />
        <StatCard label={t("equipment.periodicInspect.resultPass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.periodicInspect.resultFail")} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t("equipment.periodicInspect.resultConditional")} value={stats.conditional} icon={AlertTriangle} color="yellow" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t("equipment.periodicInspect.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-36"><Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth /></div>
          <div className="flex items-center gap-1"><CalendarCheck className="w-4 h-4 text-text-muted" /><Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-36" /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("equipment.periodicInspect.editTitle") : t("equipment.periodicInspect.addTitle")} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("equipment.periodicInspect.equipCode")} placeholder="CUT-001" defaultValue={editingItem?.equipCode} fullWidth />
            <Input label={t("equipment.periodicInspect.inspectDate")} type="date" defaultValue={editingItem?.inspectDate || new Date().toISOString().split("T")[0]} fullWidth />
            <Input label={t("equipment.periodicInspect.inspector")} placeholder={t("equipment.periodicInspect.inspectorPlaceholder")} defaultValue={editingItem?.inspectorName} fullWidth />
            <Select label={t("equipment.periodicInspect.overallResult")} options={resultOptions.slice(1)} value={editingItem?.overallResult || "PASS"} fullWidth />
          </div>
          <Input label={t("common.remark")} placeholder={t("common.remarkPlaceholder")} defaultValue={editingItem?.remark} fullWidth />
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => setIsModalOpen(false)}>{editingItem ? t("common.edit") : t("common.register")}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default PeriodicInspectPage;
