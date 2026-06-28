"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface InvHistoryItem {
  id: string;
  warehouseCode: string;
  itemCode: string;
  itemName?: string;
  unit?: string;
  matUid?: string;
  beforeQty: number;
  afterQty: number;
  diffQty: number;
  reason?: string;
  createdBy?: string;
  createdAt: string;
}

export interface CreatePhysicalInvHistoryGridColumnsOptions {
  t: TFunction;
}

export function createPhysicalInvHistoryGridColumns({
  t,
}: CreatePhysicalInvHistoryGridColumnsOptions): ColumnDef<InvHistoryItem>[] {
  return [
    {
      accessorKey: "createdAt", header: t("material.physicalInvHistory.countDate"), size: 140, meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "warehouseCode", header: t("material.physicalInvHistory.warehouse"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "matUid", header: "LOT No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      accessorKey: "beforeQty", header: t("material.physicalInvHistory.systemQty"), size: 100,
      cell: ({ getValue, row }) => (
        <span>{((getValue() as number) ?? 0).toLocaleString()} {row.original.unit || ""}</span>
      ),
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "afterQty", header: t("material.physicalInvHistory.countedQty"), size: 100,
      cell: ({ getValue, row }) => (
        <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()} {row.original.unit || ""}</span>
      ),
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "diffQty", header: t("material.physicalInvHistory.diffQty"), size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (v === 0) return <span className="text-green-600">0</span>;
        const cls = v > 0 ? "text-blue-600 font-medium" : "text-red-600 font-medium";
        return <span className={cls}>{v > 0 ? "+" : ""}{v.toLocaleString()}</span>;
      },
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "reason", header: t("material.physicalInvHistory.reason"), size: 120, meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "createdBy", header: t("material.physicalInvHistory.inspector"), size: 90, meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ];
}
