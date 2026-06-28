"use client";

import { useState } from "react";
import type { TFunction } from "i18next";
import { Edit2, Trash2, ImageIcon } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import { resolveBackendFileUrl } from "@/utils/file-url";

export type ItemType = "VISUAL" | "MEASURE";
export type InspectType = "DAILY" | "PERIODIC" | "PM" | "WORKER";

export interface InspectItemPoolRow {
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
  imageUrl: string | null;
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

/** 점검항목 썸네일 — 이미지 로드 실패 시 placeholder 아이콘으로 fallback */
function EquipInspectImageThumb({ src, alt }: { src: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="w-9 h-9 mx-auto rounded border border-dashed border-border flex items-center justify-center bg-surface">
        <ImageIcon className="w-4 h-4 text-text-muted" />
      </div>
    );
  }
  return (
    <img src={src} alt={alt} onError={() => setErrored(true)} className="w-9 h-9 object-cover rounded border border-border bg-surface" />
  );
}

interface CreateEquipInspectItemGridColumnsOptions {
  t: TFunction;
  inspectTypeLabels: Record<string, string>;
  itemTypeLabels: Record<string, string>;
  cycleLabels: Record<string, string>;
  guard: (action: () => void) => void;
  onEditItem: (item: InspectItemPoolRow) => void;
  onDeleteItem: (item: InspectItemPoolRow) => void;
}

export function createEquipInspectItemGridColumns({
  t,
  inspectTypeLabels,
  itemTypeLabels,
  cycleLabels,
  guard,
  onEditItem,
  onDeleteItem,
}: CreateEquipInspectItemGridColumnsOptions): ColumnDef<InspectItemPoolRow>[] {
  return [
    {
      id: "actions", header: "", size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => guard(() => onEditItem(row.original))} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={() => onDeleteItem(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "imageUrl", header: t("master.equipInspectItem.image", "사진"), size: 64,
      meta: { align: "center" as const },
      cell: ({ getValue, row }) => {
        const imageUrl = resolveBackendFileUrl(getValue() as string | null);
        return imageUrl ? (
          <EquipInspectImageThumb src={imageUrl} alt={row.original.itemName} />
        ) : (
          <div className="w-9 h-9 mx-auto rounded border border-dashed border-border flex items-center justify-center bg-surface">
            <ImageIcon className="w-4 h-4 text-text-muted" />
          </div>
        );
      },
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
          if (r.lslValue != null && r.uslValue != null) {
            return <span className="text-xs">{`${r.lslValue} ~ ${r.uslValue}${r.unit ? ` (${r.unit})` : ""}`}</span>;
          }
          if (r.lslValue != null) {
            return <span className="text-xs">{`>= ${r.lslValue}${r.unit ? ` ${r.unit}` : ""}`}</span>;
          }
          if (r.uslValue != null) {
            return <span className="text-xs">{`<= ${r.uslValue}${r.unit ? ` ${r.unit}` : ""}`}</span>;
          }
          if (r.criteria) {
            return <span className="text-xs">{`${r.criteria}${r.unit ? ` (${r.unit})` : ""}`}</span>;
          }
          return r.unit || "-";
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
  ];
}
