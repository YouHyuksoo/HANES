"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/InspectItemPanel.tsx
 * @description 우측 패널 - 선택된 설비의 점검항목 목록 (DB 연동)
 *
 * 초보자 가이드:
 * 1. 부모(EquipAssignTab)에서 API로 받은 items를 표시
 * 2. 삭제 시 부모의 onDelete 콜백으로 API 호출
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { Button, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { EquipSummary, InspectItemRow, INSPECT_TYPE_COLORS } from "../types";

interface Props {
  equip: EquipSummary | null;
  items: InspectItemRow[];
  loading: boolean;
  onDelete: (equipCode: string, inspectType: string, seq: number) => void;
  onOpenAddModal: () => void;
  onRefresh: () => void;
}

export default function InspectItemPanel({ equip, items, loading, onDelete, onOpenAddModal, onRefresh }: Props) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<InspectItemRow | null>(null);

  const inspectTypeLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.typeDaily"),
    PERIODIC: t("master.equipInspect.typePeriodic"),
  }), [t]);

  const cycleLabels = useMemo<Record<string, string>>(() => ({
    DAILY: t("master.equipInspect.cycleDaily"),
    WEEKLY: t("master.equipInspect.cycleWeekly"),
    MONTHLY: t("master.equipInspect.cycleMonthly"),
  }), [t]);

  const columns = useMemo<ColumnDef<InspectItemRow>[]>(() => [
    {
      id: "actions", header: "", size: 50,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <button onClick={() => setDeleteTarget(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      ),
    },
    { accessorKey: "seq", header: t("master.equipInspect.seq"), size: 60 },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 200 },
    {
      accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${INSPECT_TYPE_COLORS[v]}`}>{inspectTypeLabels[v]}</span>;
      },
    },
    { accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 180 },
    {
      accessorKey: "cycle", header: t("master.equipInspect.cycle"), size: 80,
      cell: ({ getValue }) => cycleLabels[getValue() as string] || (getValue() as string) || "-",
    },
    {
      accessorKey: "useYn", header: t("common.useYn", "사용"), size: 60,
      cell: ({ getValue }) => getValue() === "Y"
        ? <span className="text-green-600 dark:text-green-400 font-medium">Y</span>
        : <span className="text-red-500 font-medium">N</span>,
    },
  ], [t, inspectTypeLabels, cycleLabels]);

  if (!equip) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        {t("master.equipInspect.selectEquipPrompt", "좌측에서 설비를 선택하세요")}
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-text">{equip.equipCode}</p>
          <p className="text-sm text-text-muted">{equip.equipName}</p>
          <span className="px-2 py-0.5 text-xs rounded-full bg-surface text-text-muted">
            {items.length}{t("master.equipInspect.itemCount", "개 항목")}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={onOpenAddModal}>
            <Plus className="w-4 h-4 mr-1" />{t("master.equipInspect.linkItem", "점검항목 추가")}
          </Button>
        </div>
      </div>

      {items.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center h-48 text-text-muted border border-dashed border-border rounded-lg">
          <AlertCircle className="w-8 h-8 mb-2 text-orange-400" />
          <p className="text-sm font-medium">{t("master.equipInspect.noItems", "등록된 점검항목이 없습니다")}</p>
          <p className="text-xs mt-1">{t("master.equipInspect.addItemGuide", "상단 버튼으로 점검항목을 추가하세요")}</p>
        </div>
      ) : (
        <DataGrid data={items} columns={columns} isLoading={loading} enableColumnFilter
          enableExport exportFileName={`${equip.equipCode}_inspect_items`} />
      )}

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { onDelete(deleteTarget.equipCode, deleteTarget.inspectType, deleteTarget.seq); setDeleteTarget(null); } }}
        title={t("common.delete")}
        message={t("common.confirmDelete")}
      />
    </>
  );
}
