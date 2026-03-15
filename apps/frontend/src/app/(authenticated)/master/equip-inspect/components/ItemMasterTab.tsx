"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/ItemMasterTab.tsx
 * @description 점검항목 마스터 탭 - 전체 점검항목 조회/등록/수정/삭제 (DB 연동)
 *
 * 초보자 가이드:
 * 1. 모든 설비의 점검항목을 통합 조회하는 전체 뷰
 * 2. API: GET /master/equip-inspect-items (전체 목록)
 * 3. 등록 시 설비코드를 지정하여 해당 설비에 점검항목 추가
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Edit2, Trash2, Search, RefreshCw } from "lucide-react";
import { Button, Input, Modal, Select, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import api from "@/services/api";
import { InspectItemRow, INSPECT_TYPE_COLORS } from "../types";

export default function ItemMasterTab() {
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
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const typeFilterOptions = useMemo(() => [
    { value: "", label: t("master.equipInspect.inspectType") + ": " + t("common.all") },
    { value: "DAILY", label: t("master.equipInspect.inspectType") + ": " + t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.inspectType") + ": " + t("master.equipInspect.typePeriodic") },
  ], [t]);

  const typeOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.typeDaily") },
    { value: "PERIODIC", label: t("master.equipInspect.typePeriodic") },
  ], [t]);

  const cycleOptions = useMemo(() => [
    { value: "DAILY", label: t("master.equipInspect.cycleDaily") },
    { value: "WEEKLY", label: t("master.equipInspect.cycleWeekly") },
    { value: "MONTHLY", label: t("master.equipInspect.cycleMonthly") },
  ], [t]);

  const inspectTypeLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.typeDaily"),
    PERIODIC: t("master.equipInspect.typePeriodic"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
  }), [t]);

  const resetForm = () => {
    setFormEquipCode("");
    setFormItemName("");
    setFormInspectType("DAILY");
    setFormCriteria("");
    setFormCycle("DAILY");
    setFormSeq("1");
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setModalOpen(true);
  };

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
          itemName: formItemName,
          inspectType: formInspectType,
          criteria: formCriteria || null,
          cycle: formCycle,
          seq: parseInt(formSeq, 10) || 1,
        });
      } else {
        if (!formEquipCode) return;
        await api.post("/master/equip-inspect-items", {
          equipCode: formEquipCode,
          itemName: formItemName,
          inspectType: formInspectType,
          criteria: formCriteria || null,
          cycle: formCycle,
          seq: parseInt(formSeq, 10) || 1,
          useYn: "Y",
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
      setDeleteTarget(null);
      fetchData();
    } catch { /* 에러 처리 */ }
  };

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
      accessorKey: "equipCode", header: t("master.equipInspect.equipCode", "설비코드"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    { accessorKey: "seq", header: t("master.equipInspect.seq"), size: 60 },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 200, meta: { filterType: "text" as const } },
    {
      accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${INSPECT_TYPE_COLORS[type]}`}>{inspectTypeLabels[type]}</span>;
      },
    },
    { accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 180 },
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
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center flex-shrink-0">
        <p className="text-sm text-text-muted">{t("master.equipInspect.itemMasterDesc", "전체 설비의 점검항목을 통합 조회합니다")}</p>
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
        <DataGrid data={items} columns={columns} isLoading={loading} enableColumnFilter enableExport
          exportFileName={t("master.equipInspect.title")}
          emptyMessage={t("master.equipInspect.noItems")}
          toolbarLeft={
            <div className="flex gap-3 flex-1 min-w-0">
              <div className="flex-1 min-w-0">
                <Input placeholder={t("master.equipInspect.searchPlaceholder")} value={searchText}
                  onChange={e => setSearchText(e.target.value)} leftIcon={<Search className="w-4 h-4" />} fullWidth />
              </div>
              <div className="w-40 flex-shrink-0">
                <Select options={typeFilterOptions} value={typeFilter} onChange={setTypeFilter} fullWidth />
              </div>
            </div>
          } />
      </div>

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
