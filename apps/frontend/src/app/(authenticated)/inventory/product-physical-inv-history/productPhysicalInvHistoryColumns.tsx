"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

interface InvHistoryItem {
  id: string;
  warehouseCode: string;
  warehouseName?: string;
  itemCode: string;
  itemName?: string;
  unit?: string;
  prdUid?: string;
  beforeQty: number;
  afterQty: number;
  diffQty: number;
  reason?: string;
  createdBy?: string;
  createdAt: string;
}

interface CreateProductPhysicalInvHistoryGridColumnsOptions {
  t: TFunction;
}

export function createProductPhysicalInvHistoryGridColumns({
  t,
}: CreateProductPhysicalInvHistoryGridColumnsOptions): ColumnDef<InvHistoryItem>[] {
  return [
    {
      accessorKey: "createdAt", header: t("inventory.productPhysicalInvHistory.countDate"), size: 140,
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "warehouseName", header: t("inventory.productPhysicalInvHistory.warehouse"), size: 110,
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
      accessorKey: "prdUid", header: "LOT No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "beforeQty", header: t("inventory.productPhysicalInvHistory.systemQty"), size: 100,
      cell: ({ getValue, row }) => (
        <span>{((getValue() as number) ?? 0).toLocaleString()} {row.original.unit || ""}</span>
      ),
      meta: { align: "right" as const },
    },
    {
      accessorKey: "afterQty", header: t("inventory.productPhysicalInvHistory.countedQty"), size: 100,
      cell: ({ getValue, row }) => (
        <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()} {row.original.unit || ""}</span>
      ),
      meta: { align: "right" as const },
    },
    {
      accessorKey: "diffQty", header: t("inventory.productPhysicalInvHistory.diffQty"), size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        if (v === 0) return <span className="text-green-600 dark:text-green-400">0</span>;
        const cls = v > 0
          ? "text-blue-600 dark:text-blue-400 font-medium"
          : "text-red-600 dark:text-red-400 font-medium";
        return <span className={cls}>{v > 0 ? "+" : ""}{v.toLocaleString()}</span>;
      },
      meta: { align: "right" as const },
    },
    {
      accessorKey: "reason", header: t("inventory.productPhysicalInvHistory.reason"), size: 120,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "createdBy", header: t("inventory.productPhysicalInvHistory.inspector"), size: 90,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ];
}
