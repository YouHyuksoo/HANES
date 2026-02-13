"use client";

/**
 * @file src/app/(authenticated)/equipment/daily-inspect/page.tsx
 * @description 설비 일상점검 페이지 - 매일 수행하는 설비 점검 결과 CRUD
 *
 * 초보자 가이드:
 * 1. **일상점검**: 매일 설비 가동 전/후 수행하는 기본 점검
 * 2. **결과**: PASS(합격), FAIL(불합격), CONDITIONAL(조건부)
 * 3. inspectType="DAILY" 고정
 */
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import {
  ClipboardCheck, Plus, Search, RefreshCw, Edit2, Trash2,
  CheckCircle, XCircle, AlertTriangle, Calendar,
} from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";

interface DailyInspect {
  id: string;
  equipCode: string;
  equipName: string;
  inspectDate: string;
  inspectorName: string;
  overallResult: string;
  remark: string;
}

const resultKeys: Record<string, string> = { PASS: "equipment.dailyInspect.resultPass", FAIL: "equipment.dailyInspect.resultFail", CONDITIONAL: "equipment.dailyInspect.resultConditional" };
const resultColors: Record<string, string> = {
  PASS: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  FAIL: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  CONDITIONAL: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
};

const mockData: DailyInspect[] = [
  { id: "1", equipCode: "CUT-001", equipName: "절단기 1호", inspectDate: "2025-02-01", inspectorName: "김점검", overallResult: "PASS", remark: "" },
  { id: "2", equipCode: "CRM-001", equipName: "압착기 1호", inspectDate: "2025-02-01", inspectorName: "이점검", overallResult: "PASS", remark: "" },
  { id: "3", equipCode: "CRM-002", equipName: "압착기 2호", inspectDate: "2025-02-01", inspectorName: "이점검", overallResult: "FAIL", remark: "압착 압력 부족" },
  { id: "4", equipCode: "ASM-001", equipName: "조립기 1호", inspectDate: "2025-02-01", inspectorName: "박점검", overallResult: "CONDITIONAL", remark: "소음 주시 필요" },
  { id: "5", equipCode: "INS-001", equipName: "검사기 1호", inspectDate: "2025-01-31", inspectorName: "김점검", overallResult: "PASS", remark: "" },
];

function DailyInspectPage() {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DailyInspect | null>(null);

  const resultOptions = [
    { value: "", label: t("equipment.dailyInspect.allResult") },
    { value: "PASS", label: t("equipment.dailyInspect.resultPass") }, { value: "FAIL", label: t("equipment.dailyInspect.resultFail") }, { value: "CONDITIONAL", label: t("equipment.dailyInspect.resultConditional") },
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

  const columns = useMemo<ColumnDef<DailyInspect>[]>(() => [
    { accessorKey: "inspectDate", header: t("equipment.dailyInspect.inspectDate"), size: 100 },
    { accessorKey: "equipCode", header: t("equipment.dailyInspect.equipCode"), size: 100 },
    { accessorKey: "equipName", header: t("equipment.dailyInspect.equipName"), size: 120 },
    { accessorKey: "inspectorName", header: t("equipment.dailyInspect.inspector"), size: 80 },
    { accessorKey: "overallResult", header: t("equipment.dailyInspect.result"), size: 80, cell: ({ getValue }) => { const r = getValue() as string; return <span className={`px-2 py-0.5 text-xs rounded-full ${resultColors[r] || ""}`}>{t(resultKeys[r])}</span>; } },
    { accessorKey: "remark", header: t("common.remark"), size: 150 },
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
          <h1 className="text-xl font-bold text-text flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-primary" />{t("equipment.dailyInspect.title")}</h1>
          <p className="text-text-muted mt-1">{t("equipment.dailyInspect.subtitle")}</p>
        </div>
        <Button size="sm" onClick={() => { setEditingItem(null); setIsModalOpen(true); }}><Plus className="w-4 h-4 mr-1" />{t("common.register")}</Button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <StatCard label={t("equipment.dailyInspect.statTotal")} value={stats.total} icon={ClipboardCheck} color="blue" />
        <StatCard label={t("equipment.dailyInspect.resultPass")} value={stats.pass} icon={CheckCircle} color="green" />
        <StatCard label={t("equipment.dailyInspect.resultFail")} value={stats.fail} icon={XCircle} color="red" />
        <StatCard label={t("equipment.dailyInspect.resultConditional")} value={stats.conditional} icon={AlertTriangle} color="yellow" />
      </div>
      <Card><CardContent>
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex-1 min-w-[200px]"><Input placeholder={t("equipment.dailyInspect.searchPlaceholder")} value={searchText} onChange={(e) => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth /></div>
          <div className="w-36"><Select options={resultOptions} value={resultFilter} onChange={setResultFilter} fullWidth /></div>
          <div className="flex items-center gap-1"><Calendar className="w-4 h-4 text-text-muted" /><Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-36" /></div>
          <Button variant="secondary"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <DataGrid data={filteredData} columns={columns} pageSize={10} />
      </CardContent></Card>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? t("equipment.dailyInspect.editTitle") : t("equipment.dailyInspect.addTitle")} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t("equipment.dailyInspect.equipCode")} placeholder="CUT-001" defaultValue={editingItem?.equipCode} fullWidth />
            <Input label={t("equipment.dailyInspect.inspectDate")} type="date" defaultValue={editingItem?.inspectDate || new Date().toISOString().split("T")[0]} fullWidth />
            <Input label={t("equipment.dailyInspect.inspector")} placeholder={t("equipment.dailyInspect.inspectorPlaceholder")} defaultValue={editingItem?.inspectorName} fullWidth />
            <Select label={t("equipment.dailyInspect.overallResult")} options={resultOptions.slice(1)} value={editingItem?.overallResult || "PASS"} fullWidth />
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

export default DailyInspectPage;
