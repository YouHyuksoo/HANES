"use client";

/**
 * @file src/app/(authenticated)/master/equip-inspect/components/InspectItemPanel.tsx
 * @description 우측 패널 - 선택된 설비의 점검항목 목록
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import { EquipSummary, InspectItemMaster, EquipInspectLink, INSPECT_TYPE_COLORS } from "../types";

interface Props {
  equip: EquipSummary | null;
  links: EquipInspectLink[];
  allItems: InspectItemMaster[];
  onOpenLinkModal: () => void;
  onUnlink: (linkId: string) => void;
}

interface RowData {
  linkId: string;
  seq: number;
  itemCode: string;
  itemName: string;
  inspectType: string;
  criteria: string;
  cycle: string;
}

export default function InspectItemPanel({ equip, links, allItems, onOpenLinkModal, onUnlink }: Props) {
  const { t } = useTranslation();

  const itemMap = useMemo(() => new Map(allItems.map(i => [i.itemCode, i])), [allItems]);

  const rows = useMemo<RowData[]>(() => {
    if (!equip) return [];
    return links
      .filter(l => l.equipCode === equip.equipCode)
      .sort((a, b) => a.seq - b.seq)
      .map(l => {
        const master = itemMap.get(l.itemCode);
        return {
          linkId: l.id,
          seq: l.seq,
          itemCode: l.itemCode,
          itemName: master?.itemName || l.itemCode,
          inspectType: master?.inspectType || "",
          criteria: master?.criteria || "",
          cycle: master?.cycle || "",
        };
      });
  }, [equip, links, itemMap]);

  const columns = useMemo<ColumnDef<RowData>[]>(() => [
    {
      id: "actions", header: "", size: 50,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <button onClick={() => onUnlink(row.original.linkId)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
          <Trash2 className="w-4 h-4 text-red-500" />
        </button>
      ),
    },
    { accessorKey: "seq", header: t("master.equipInspect.seq"), size: 50 },
    { accessorKey: "itemCode", header: t("master.equipInspect.itemCode", "항목코드"), size: 90 },
    { accessorKey: "itemName", header: t("master.equipInspect.itemName"), size: 160 },
    {
      accessorKey: "inspectType", header: t("master.equipInspect.inspectType"), size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const color = INSPECT_TYPE_COLORS[v] || "";
        const label = v === "DAILY" ? t("master.equipInspect.typeDaily") : v === "PERIODIC" ? t("master.equipInspect.typePeriodic") : v;
        return <span className={`px-2 py-0.5 text-xs rounded-full ${color}`}>{label}</span>;
      },
    },
    { accessorKey: "criteria", header: t("master.equipInspect.criteria"), size: 160 },
    { accessorKey: "cycle", header: t("master.equipInspect.cycle"), size: 70 },
  ], [t, onUnlink]);

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
          <span className="px-2 py-0.5 text-xs rounded-full bg-surface text-text-muted">{rows.length}{t("master.equipInspect.itemCount", "개 항목")}</span>
        </div>
        <Button size="sm" onClick={onOpenLinkModal}>
          <Plus className="w-4 h-4 mr-1" />{t("master.equipInspect.linkItem", "점검항목 추가")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-text-muted border border-dashed border-border rounded-lg">
          <AlertCircle className="w-8 h-8 mb-2 text-orange-400" />
          <p className="text-sm font-medium">{t("master.equipInspect.noItems", "등록된 점검항목이 없습니다")}</p>
          <p className="text-xs mt-1">{t("master.equipInspect.addItemGuide", "상단 버튼으로 점검항목을 추가하세요")}</p>
        </div>
      ) : (
        <DataGrid data={rows} columns={columns} enableExport exportFileName={`${equip.equipCode}_inspect_items`} />
      )}
    </>
  );
}
