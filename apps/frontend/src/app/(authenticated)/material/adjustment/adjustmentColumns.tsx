"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface AdjustmentRecord {
  id: string;
  warehouseCode: string;
  itemCode?: string;
  itemName?: string;
  unit?: string;
  beforeQty: number;
  afterQty: number;
  diffQty: number;
  reason: string;
  createdBy?: string;
  createdAt: string;
}

export interface CreateAdjustmentGridColumnsOptions {
  t: TFunction;
}

export function createAdjustmentGridColumns({
  t,
}: CreateAdjustmentGridColumnsOptions): ColumnDef<AdjustmentRecord>[] {
  return [
    {
      accessorKey: "createdAt", header: t("material.adjustment.createdAt"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "warehouseCode", header: t("material.adjustment.warehouse"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "beforeQty", header: t("material.adjustment.beforeQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{row.original.beforeQty.toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "afterQty", header: t("material.adjustment.afterQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span className="font-medium">{row.original.afterQty.toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "diffQty", header: t("material.adjustment.diffQty"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const diff = getValue() as number;
        if (diff === 0) return <span className="text-text-muted">0</span>;
        const cls = diff > 0
          ? "text-blue-600 dark:text-blue-400 font-medium"
          : "text-red-600 dark:text-red-400 font-medium";
        return <span className={cls}>{diff > 0 ? "+" : ""}{diff.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "reason", header: t("material.adjustment.reason"), size: 160,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "createdBy", header: t("material.adjustment.createdBy"), size: 80, meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ];
}
