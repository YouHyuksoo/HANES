"use client";

import { useState } from "react";
import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import { type ConsumableItem } from "./components/ConsumableFormPanel";

/** 소모품 썸네일 — 이미지 로드 실패 시 '-'로 fallback */
function ConsumableImageThumb({ src }: { src: string }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <span className="text-text-muted text-xs">-</span>;
  return (
    <img
      src={src}
      alt=""
      onError={() => setErrored(true)}
      className="w-8 h-8 object-cover rounded border border-border"
    />
  );
}

interface CreateConsumableMasterGridColumnsOptions {
  t: TFunction;
  onEdit: (item: ConsumableItem) => void;
  onDelete: (consumableCode: string) => void;
}

export function createConsumableMasterGridColumns({
  t,
  onEdit,
  onDelete,
}: CreateConsumableMasterGridColumnsOptions): ColumnDef<ConsumableItem>[] {
  return [
    {
      id: "actions",
      header: t("common.manage"),
      size: 90,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            onClick={() => { onEdit(row.original); }}
            className="p-1 hover:bg-surface rounded"
          >
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(row.original.consumableCode); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      id: "image",
      header: t("consumables.master.sectionImage", "이미지"),
      size: 60,
      meta: { filterType: "none" as const, align: "center" as const },
      cell: ({ row }) => row.original.imageUrl ? (
        <ConsumableImageThumb src={row.original.imageUrl} />
      ) : (
        <span className="text-text-muted text-xs">-</span>
      ),
    },
    { accessorKey: "consumableCode", header: t("consumables.master.code"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "consumableName", header: t("consumables.master.name"), size: 170, meta: { filterType: "text" as const } },
    {
      accessorKey: "category",
      header: t("consumables.master.category"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} />,
    },
    {
      accessorKey: "expectedLife",
      header: t("consumables.master.expectedLife"),
      size: 100,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return v ? v.toLocaleString() : "-";
      },
    },
    {
      accessorKey: "safetyStock",
      header: t("consumables.master.safetyStock", "안전재고"),
      size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString(),
    },
    { accessorKey: "location", header: t("consumables.master.location"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "vendor", header: t("consumables.master.vendor"), size: 100, meta: { filterType: "text" as const } },
    {
      accessorKey: "unitPrice",
      header: t("consumables.master.unitPrice", "단가"),
      size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return v ? `${v.toLocaleString()}` : "-";
      },
    },
  ];
}
