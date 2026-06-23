"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { Button, ConfirmModal } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { InspectItemImage } from "@/components/shared";
import { EquipSummary, InspectItemRow } from "../types";

interface Props {
  equip: EquipSummary | null;
  items: InspectItemRow[];
  loading: boolean;
  onDelete: (equipCode: string, itemCode: string, inspectType: string) => void;
  onOpenAddModal: () => void;
  onRefresh: () => void;
}

export default function InspectItemPanel({ equip, items, loading, onDelete, onOpenAddModal, onRefresh }: Props) {
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<InspectItemRow | null>(null);

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
    {
      accessorKey: "imageUrl", header: t("master.equipInspect.image", "사진"), size: 64,
      enableColumnFilter: false,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex justify-center">
          <InspectItemImage imageUrl={row.original.imageUrl} alt={row.original.itemName ?? row.original.itemCode} size={40} />
        </div>
      ),
    },
    {
      accessorKey: "itemCode",
      header: t("master.equipInspect.itemCode", "항목코드"),
      size: 120,
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>,
    },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 200 },
    { accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 180 },
    {
      accessorKey: "cycle", header: t("master.equipInspect.cycle"), size: 80,
      cell: ({ getValue }) => cycleLabels[getValue() as string] || (getValue() as string) || "-",
    },
    { accessorKey: "sortSeq", header: t("master.equipInspect.sortSeq", "순서"), size: 60 },
    {
      accessorKey: "useYn", header: t("common.useYn", "사용"), size: 60,
      cell: ({ getValue }) => getValue() === "Y"
        ? <span className="text-green-600 dark:text-green-400 font-medium">Y</span>
        : <span className="text-red-500 font-medium">N</span>,
    },
  ], [t, cycleLabels]);

  if (!equip) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        {t("master.equipInspect.selectEquipPrompt", "좌측에서 설비를 선택하세요")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-3 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-medium text-text shrink-0">{equip.equipCode}</p>
          <p className="text-sm text-text-muted truncate">{equip.equipName}</p>
          <span className="px-2 py-0.5 text-xs rounded-full bg-surface text-text-muted shrink-0">
            {items.length}{t("master.equipInspect.itemCount", "개 항목")}
          </span>
        </div>
        <div className="flex gap-2 shrink-0 ml-2">
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />{t("common.refresh")}
          </Button>
          <Button size="sm" onClick={onOpenAddModal}>
            <Plus className="w-4 h-4 mr-1" />{t("master.equipInspect.linkItem", "점검항목 추가")}
          </Button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 min-h-0">
        {items.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted border border-dashed border-border rounded-lg">
            <AlertCircle className="w-8 h-8 mb-2 text-orange-400" />
            <p className="text-sm font-medium">{t("master.equipInspect.noItems", "등록된 점검항목이 없습니다")}</p>
            <p className="text-xs mt-1">{t("master.equipInspect.addItemGuide", "상단 버튼으로 점검항목을 추가하세요")}</p>
          </div>
        ) : (
          <DataGrid data={items} columns={columns} isLoading={loading} enableColumnFilter
            enableExport exportFileName={`${equip.equipCode}_inspect_items`}
            sqlQuery={`SELECT *\nFROM EQUIP_INSPECT_ITEM_MASTERS\nWHERE COMPANY = '40'\n  AND PLANT_CD = '1000'\nORDER BY CREATED_AT DESC`}/>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) { onDelete(deleteTarget.equipCode, deleteTarget.itemCode, deleteTarget.inspectType); setDeleteTarget(null); } }}
        title={t("common.delete")}
        message={t("common.confirmDelete")}
        variant="danger"
      />
    </div>
  );
}
