"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect-item/page.tsx
 * @description 점검항목 마스터 독립 페이지 - 전체 설비의 점검항목 통합 CRUD
 *
 * 초보자 가이드:
 * 1. 모든 설비의 점검항목을 한눈에 조회/등록/수정/삭제
 * 2. 등록 시 설비코드를 셀렉트로 지정
 * 3. 캘린더 스케줄의 기초 데이터가 되는 마스터
 * 4. API: GET/POST/PUT/DELETE /master/equip-inspect-items
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList, Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Card, CardContent, Button, Input, Modal, Select, ConfirmModal, StatCard } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";

interface InspectItemRow {
  equipCode: string;
  inspectType: "DAILY" | "PERIODIC" | "PM";
  seq: number;
  itemName: string;
  criteria: string | null;
  cycle: string | null;
  useYn: string;
}

const INSPECT_TYPE_COLORS: Record<string, string> = {
  DAILY: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  PERIODIC: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  PM: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

export default function EquipInspectItemPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<InspectItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InspectItemRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InspectItemRow | null>(null);

  /* ── 폼 상태 ── */
  const [formEquipCode, setFormEquipCode] = useState("");
  const [formItemName, setFormItemName] = useState("");
  const [formInspectType, setFormInspectType] = useState<"DAILY" | "PERIODIC" | "PM">("DAILY");
  const [formCriteria, setFormCriteria] = useState("");
  const [formCycle, setFormCycle] = useState("DAILY");
  const [formSeq, setFormSeq] = useState("1");

  /* ── 설비 목록 (등록 시 선택용) ── */
  const [equipOptions, setEquipOptions] = useState<{ value: string; label: string }[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/equipment/equips", { params: { limit: "500" } });
        setEquipOptions((res.data?.data ?? []).map((e: Record<string, string>) => ({
          value: e.equipCode, label: `${e.equipCode} ${e.equipName}`,
        })));
      } catch { /* keep empty */ }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "5000" };
      if (searchText) params.search = searchText;
      if (typeFilter) params.inspectType = typeFilter;
      const res = await api.get("/master/equip-inspect-items", { params });
      setItems(res.data?.data ?? []);
    } catch { setItems([]); }
    finally { setLoading(false); }
  }, [searchText, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── 옵션 ── */
  const typeFilterOptions = useMemo(() => [
    { value: "", label: `${t("master.equipInspect.inspectType")}: ${t("common.all")}` },
    { value: "DAILY", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typeDaily")}` },
    { value: "PERIODIC", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePeriodic")}` },
    { value: "PM", label: `${t("master.equipInspect.inspectType")}: ${t("master.equipInspect.typePM", "예방보전")}` },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
    { value: "PM", label: t("master.equipInspect.typePM", "예방보전") },
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
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
  }), [t]);

  /* ── 통계 ── */
  const stats = useMemo(() => {
    const daily = items.filter(i => i.inspectType === "DAILY").length;
    const periodic = items.filter(i => i.inspectType === "PERIODIC").length;
    const pm = items.filter(i => i.inspectType === "PM").length;
    const equipSet = new Set(items.map(i => i.equipCode));
    return { total: items.length, daily, periodic, pm, equipCount: equipSet.size };
  }, [items]);

  /* ── CRUD ── */
  const resetForm = () => {
    setFormEquipCode(""); setFormItemName(""); setFormInspectType("DAILY");
    setFormCriteria(""); setFormCycle("DAILY"); setFormSeq("1");
  };

  const openCreate = () => { setEditing(null); resetForm(); setModalOpen(true); };

  const openEdit = (item: InspectItemRow) => {
    setEditing(item);
    setFormEquipCode(item.equipCode);
    setFormItemName(item.itemName);
    setFormInspectType(item.inspectType);
    setFormCriteria(item.criteria || "");
    setFormCycle(item.cycle || "DAILY");
    setFormSeq(String(item.seq));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formItemName.trim()) return;
    try {
      if (editing) {
        await api.put(`/master/equip-inspect-items/${editing.equipCode}/${editing.inspectType}/${editing.seq}`, {
          itemName: formItemName, inspectType: formInspectType,
          criteria: formCriteria || null, cycle: formCycle,
          seq: parseInt(formSeq, 10) || 1,
        });
      } else {
        if (!formEquipCode) return;
        await api.post("/master/equip-inspect-items", {
          equipCode: formEquipCode, itemName: formItemName,
          inspectType: formInspectType, criteria: formCriteria || null,
          cycle: formCycle, seq: parseInt(formSeq, 10) || 1, useYn: "Y",
        });
      }
      setModalOpen(false);
      fetchData();
    } catch { /* 에러 처리 */ }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/master/equip-inspect-items/${deleteTarget.equipCode}/${deleteTarget.inspectType}/${deleteTarget.seq}`);
      setDeleteTarget(null); fetchData();
    } catch { /* 에러 처리 */ }
  };

  /* ── 컬럼 ── */
  const columns: ColumnDef<InspectItemRow>[] = useMemo(() => [
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
      accessorKey: "equipCode", header: t("master.equipInspect.equipCode", "설비코드"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    { accessorKey: "seq", header: t("master.equipInspect.seq"), size: 60 },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 220, meta: { filterType: "text" as const } },
    {
      accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${INSPECT_TYPE_COLORS[type]}`}>{inspectTypeLabels[type]}</span>;
      },
    },
    { accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 200 },
    {
      accessorKey: "cycle", header: t("master.equipInspect.cycle"), size: 90,
      cell: ({ getValue }) => cycleLabels[getValue() as string] || getValue(),
    },
    {
      accessorKey: "useYn", header: t("common.useYn", "사용"), size: 60,
      cell: ({ getValue }) => getValue() === "Y"
        ? <span className="text-green-600 dark:text-green-400 font-medium">Y</span>
        : <span className="text-red-500 font-medium">N</span>,
    },
  ], [t, inspectTypeLabels, cycleLabels]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      {/* 헤더 */}
      <div className="flex justify-between items-center flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-primary" />
            {t("master.equipInspectItem.title", "점검항목 마스터")}
          </h1>
          <p className="text-text-muted mt-1">{t("master.equipInspectItem.subtitle", "설비 점검항목을 등록하고 관리합니다. 캘린더 스케줄의 기초 데이터입니다.")}</p>
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

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-3 flex-shrink-0">
        <StatCard label={t("master.equipInspectItem.statTotal", "전체 항목")} value={stats.total} icon={ClipboardList} color="blue" />
        <StatCard label={t("master.equipInspect.typeDaily")} value={stats.daily} icon={ClipboardList} color="green" />
        <StatCard label={t("master.equipInspect.typePeriodic")} value={stats.periodic} icon={ClipboardList} color="orange" />
        <StatCard label={t("master.equipInspect.typePM", "예방보전")} value={stats.pm} icon={ClipboardList} color="purple" />
        <StatCard label={t("master.equipInspectItem.statEquips", "설비 수")} value={stats.equipCount} icon={ClipboardList} color="gray" />
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
                <Select options={typeFilterOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
            </div>
          } />
      </CardContent></Card>

      {/* 등록/수정 모달 */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? t("master.equipInspect.editItem") : t("common.register", "등록")} size="lg">
        <div className="space-y-4">
          <Select
            label={t("master.equipInspect.equipCode", "설비코드")}
            options={equipOptions}
            value={editing ? editing.equipCode : formEquipCode}
            onChange={setFormEquipCode}
            disabled={!!editing}
            fullWidth
          />
          <Input label={t("master.equipInspect.itemName")} value={formItemName}
            onChange={e => setFormItemName(e.target.value)} fullWidth />
          <div className="grid grid-cols-3 gap-4">
            <Select label={t("master.equipInspect.inspectType")} options={typeOptions}
              value={formInspectType} onChange={v => setFormInspectType(v as "DAILY" | "PERIODIC" | "PM")} />
            <Select label={t("master.equipInspect.cycle")} options={cycleOptions}
              value={formCycle} onChange={setFormCycle} />
            <Input label={t("master.equipInspect.seq")} type="number" value={formSeq}
              onChange={e => setFormSeq(e.target.value)} fullWidth />
          </div>
          <Input label={t("master.equipInspect.criteria")} value={formCriteria}
            onChange={e => setFormCriteria(e.target.value)} fullWidth />
        </div>
        <div className="flex justify-end gap-2 pt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>{t("common.cancel")}</Button>
          <Button onClick={handleSave} disabled={!formItemName.trim() || (!editing && !formEquipCode)}>
            {editing ? t("common.save") : t("common.register", "등록")}
          </Button>
        </div>
      </Modal>

      <ConfirmModal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm}
        title={t("common.delete")} message={t("common.confirmDelete")} />
    </div>
  );
}
