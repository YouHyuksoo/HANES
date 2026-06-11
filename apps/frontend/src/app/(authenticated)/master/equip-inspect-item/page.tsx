"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect-item/page.tsx
 * @description 점검항목 마스터 페이지 - 설비유형별 점검항목 풀(EQUIP_INSPECT_ITEM_POOL) 통합 CRUD
 *
 * 초보자 가이드:
 * 1. 점검항목을 설비유형(EQUIP_TYPE) 기준으로 등록/관리하는 "구성용 기준 정보"(마스터)
 * 2. 설비별 실제 매핑은 /master/equip-inspect 에서 수행하며, 항목 추가 시 설비유형으로 이 마스터를 조회
 * 3. API: GET/POST/PUT/DELETE /master/equip-inspect-item-masters
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ConfirmModal, ComCodeBadge } from "@/components/ui";
import { ComCodeSelect } from "@/components/shared";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

type ItemType = "VISUAL" | "MEASURE";
type InspectType = "DAILY" | "PERIODIC" | "PM" | "WORKER";

interface InspectItemPoolRow {
  itemCode: string;
  itemName: string;
  inspectType: InspectType;
  equipType: string | null;
  criteria: string | null;
  cycle: string | null;
  useYn: string;
  itemType: ItemType;
  unit: string | null;
  lslValue: number | null;
  uslValue: number | null;
  remark: string | null;
}

const INSPECT_TYPE_COLORS: Record<string, string> = {
  DAILY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PERIODIC: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  PM: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  WORKER: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const ITEM_TYPE_COLORS: Record<string, string> = {
  VISUAL: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  MEASURE: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
};

export default function EquipInspectItemPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InspectItemPoolRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [equipTypeFilter, setEquipTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InspectItemPoolRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InspectItemPoolRow | null>(null);

  /* ── 폼 상태 ── */
  const [formItemCode, setFormItemCode] = useState("");
  const [formEquipType, setFormEquipType] = useState("");
  const [formItemName, setFormItemName] = useState("");
  const [formInspectType, setFormInspectType] = useState<InspectType>("DAILY");
  const [formCriteria, setFormCriteria] = useState("");
  const [formCycle, setFormCycle] = useState("DAILY");
  const [formItemType, setFormItemType] = useState<ItemType>("VISUAL");
  const [formUnit, setFormUnit] = useState("");
  const [formLsl, setFormLsl] = useState("");
  const [formUsl, setFormUsl] = useState("");
  const [formUseYn, setFormUseYn] = useState("Y");
  const [formRemark, setFormRemark] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.inspectType = typeFilter;
      if (equipTypeFilter) params.equipType = equipTypeFilter;
      const res = await api.get("/master/equip-inspect-item-masters", { params });
      setItems(res.data?.data ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [searchText, typeFilter, equipTypeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 옵션 ── */
  const typeFilterOptions = useMemo(() => [
    { value: "", label: `${t("master.equipInspect.inspectType")}: ${t("common.all")}` },
    { value: "DAILY", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typeDaily")}` },
    { value: "PERIODIC", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePeriodic")}` },
    { value: "PM", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePM")}` },
    { value: "WORKER", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typeWorker")}` },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
    { value: "PM", label: t("master.equipInspect.typePM") },
    { value: "WORKER", label: t("master.equipInspect.typeWorker") },
  ], [t]);

  const itemTypeOptions = useMemo(() => [
    { value: "VISUAL", label: t("master.equipInspect.itemTypeVisual", "판정형") },
    { value: "MEASURE", label: t("master.equipInspect.itemTypeMeasure", "측정형") },
  ], [t]);

  const itemTypeLabels = useMemo<Record<string, string>>(() => ({
    VISUAL: t("master.equipInspect.itemTypeVisual", "판정형"),
    MEASURE: t("master.equipInspect.itemTypeMeasure", "측정형"),
  }), [t]);

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
    PM: t("master.equipInspect.typePM"),
    WORKER: t("master.equipInspect.typeWorker"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
    QUARTERLY: t("master.equipInspect.cycleQuarterly", "분기"),
    SEMI_ANNUAL: t("master.equipInspect.cycleSemiAnnual", "반기"),
    ANNUAL: t("master.equipInspect.cycleAnnual", "연간"),
  }), [t]);

  /* ── CRUD ── */
  const resetForm = () => {
    setFormItemCode(""); setFormEquipType(""); setFormItemName(""); setFormInspectType("DAILY");
    setFormCriteria(""); setFormCycle("DAILY"); setFormItemType("VISUAL");
    setFormUnit(""); setFormLsl(""); setFormUsl(""); setFormUseYn("Y"); setFormRemark("");
  };

  const openCreate = () => { setEditing(null); resetForm(); setModalOpen(true); };

  const openEdit = (item: InspectItemPoolRow) => {
    setEditing(item);
    setFormItemCode(item.itemCode);
    setFormEquipType(item.equipType || "");
    setFormItemName(item.itemName);
    setFormInspectType(item.inspectType);
    setFormCriteria(item.criteria || "");
    setFormCycle(item.cycle || "DAILY");
    setFormItemType(item.itemType || "VISUAL");
    setFormUnit(item.unit || "");
    setFormLsl(item.lslValue != null ? String(item.lslValue) : "");
    setFormUsl(item.uslValue != null ? String(item.uslValue) : "");
    setFormUseYn(item.useYn || "Y");
    setFormRemark(item.remark || "");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formItemCode.trim() || !formItemName.trim()) return;
    const isMeasure = formItemType === "MEASURE";
    const payload = {
      itemCode: formItemCode.trim(),
      itemName: formItemName.trim(),
      inspectType: formInspectType,
      equipType: formEquipType || null,
      criteria: !isMeasure ? (formCriteria.trim() || null) : null,
      cycle: formCycle || null,
      useYn: formUseYn,
      remark: formRemark.trim() || null,
      itemType: formItemType,
      unit: isMeasure ? (formUnit.trim() || null) : null,
      lslValue: isMeasure && formLsl !== "" ? Number(formLsl) : null,
      uslValue: isMeasure && formUsl !== "" ? Number(formUsl) : null,
    };
    try {
      if (editing) {
        await api.put(`/master/equip-inspect-item-masters/${editing.itemCode}`, payload);
      } else {
        await api.post("/master/equip-inspect-item-masters", payload);
      }
      setModalOpen(false);
      fetchData();
    } catch { /* 에러 처리: 공통 API 레이어 */ }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/equip-inspect-item-masters/${deleteTarget.itemCode}`);
      setDeleteTarget(null); fetchData();
    } catch { /* 에러 처리 */ }
  };

  /* ── 컬럼 ── */
  const columns: ColumnDef<InspectItemPoolRow>[] = useMemo(() => [
    {
      id: "actions", header: "", size: 80,
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
      accessorKey: "itemCode", header: t("master.equipInspect.itemCode", "항목코드"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "equipType", header: t("master.equip.type", "설비유형"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="EQUIP_TYPE" code={v} /> : <span className="text-text-muted">-</span>;
      },
    },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 220, meta: { filterType: "text" as const } },
    {
      accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${INSPECT_TYPE_COLORS[type]}`}>{inspectTypeLabels[type]}</span>;
      },
    },
    {
      accessorKey: "itemType", header: t("master.equipInspect.itemType", "판정구분"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = (getValue() as string) || "VISUAL";
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${ITEM_TYPE_COLORS[v]}`}>{itemTypeLabels[v]}</span>;
      },
    },
    {
      accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 200,
      cell: ({ row }) => {
        const r = row.original;
        if (r.itemType === "MEASURE") {
          const lsl = r.lslValue != null ? r.lslValue : "";
          const usl = r.uslValue != null ? r.uslValue : "";
          return <span className="text-xs">{`${lsl} ~ ${usl}${r.unit ? ` (${r.unit})` : ""}`}</span>;
        }
        return r.criteria || "-";
      },
    },
    {
      accessorKey: "cycle", header: t("master.equipInspect.cycle"), size: 90,
      cell: ({ getValue }) => cycleLabels[getValue() as string] || getValue() || "-",
    },
    {
      accessorKey: "useYn", header: t("common.useYn", "사용"), size: 60,
      cell: ({ getValue }) => getValue() === "Y"
        ? <span className="text-green-600 dark:text-green-400 font-medium">Y</span>
        : <span className="text-red-500 font-medium">N</span>,
    },
  ], [t, inspectTypeLabels, cycleLabels, itemTypeLabels]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("master.equipInspectItem.title", "점검항목 마스터")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.equipInspectItem.subtitle", "설비유형별 점검항목을 등록하고 관리합니다. 설비점검 매핑의 기준 정보입니다.")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={fetchData}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />{t("common.register", "등록")}
          </Button>
        </div>
      </div>

      {/* 데이터 그리드 */}
      <Card className="flex-1 min-h-0 overflow-hidden" padding="none"><CardContent className="h-full p-4">
        <DataGrid data={items} columns={columns} isLoading={loading} enableColumnFilter enableExport
          exportFileName={t("master.equipInspectItem.title", "점검항목마스터")}
          emptyMessage={t("master.equipInspect.noItems")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("master.equipInspect.searchPlaceholder")} value={searchText}
                  onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-44 flex-shrink-0">
                <ComCodeSelect groupCode="EQUIP_TYPE" value={equipTypeFilter} onChange={setEquipTypeFilter} labelPrefix={t("master.equip.type", "설비유형")} />
              </div>
              <div className="w-44 flex-shrink-0">
                <Select options={typeFilterOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
            </div>
          }
          sqlQuery={`SELECT *\nFROM EQUIP_INSPECT_ITEM_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY EQUIP_TYPE, INSPECT_TYPE, ITEM_CODE`}/>
      </CardContent></Card>

      {/* 등록/수정 모달 */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? t("master.equipInspect.editItem") : t("common.register", "등록")} size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <Input label={t("master.equipInspect.itemCode", "항목코드")} value={formItemCode}
              onChange={e => setFormItemCode(e.target.value)} disabled={!!editing} fullWidth />
            <ComCodeSelect groupCode="EQUIP_TYPE" includeAll={false} label={t("master.equip.type", "설비유형")}
              value={formEquipType} onChange={setFormEquipType} fullWidth />
            <Select label={t("master.equipInspect.inspectType")} options={typeOptions}
              value={formInspectType} onChange={v => setFormInspectType(v as InspectType)} fullWidth />
          </div>
          <Input label={t("master.equipInspect.itemName")} value={formItemName}
            onChange={e => setFormItemName(e.target.value)} fullWidth />
          <div className="grid grid-cols-3 gap-4">
            <Select label={t("master.equipInspect.itemType", "판정구분")} options={itemTypeOptions}
              value={formItemType} onChange={v => setFormItemType(v as ItemType)} fullWidth />
            <Select label={t("master.equipInspect.cycle")} options={cycleOptions}
              value={formCycle} onChange={setFormCycle} fullWidth />
            <Select label={t("common.useYn", "사용")} options={[{ value: "Y", label: "Y" }, { value: "N", label: "N" }]}
              value={formUseYn} onChange={setFormUseYn} fullWidth />
          </div>
          {formItemType === "MEASURE" ? (
            <div className="grid grid-cols-3 gap-4">
              <Input label={t("master.equipInspect.unit", "단위")} value={formUnit}
                onChange={e => setFormUnit(e.target.value)} fullWidth />
              <Input label={t("master.equipInspect.lowerLimit", "하한")} type="number" value={formLsl}
                onChange={e => setFormLsl(e.target.value)} fullWidth />
              <Input label={t("master.equipInspect.upperLimit", "상한")} type="number" value={formUsl}
                onChange={e => setFormUsl(e.target.value)} fullWidth />
            </div>
          ) : (
            <Input label={t("master.equipInspect.criteria")} value={formCriteria}
              onChange={e => setFormCriteria(e.target.value)} fullWidth />
          )}
          <Input label={t("common.remark", "비고")} value={formRemark}
            onChange={e => setFormRemark(e.target.value)} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!formItemCode.trim() || !formItemName.trim()}>
            {editing ? t("common.save") : t("common.register", "등록")}
          </Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm}
        title={t("common.delete")} message={t("common.confirmDelete")} />
    </div>
  );
}
