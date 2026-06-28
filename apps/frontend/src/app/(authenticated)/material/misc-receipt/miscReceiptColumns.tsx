"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface MiscReceiptRecord {
  id: string;
  transNo: string;
  itemCode: string;
  itemName: string;
  warehouseName: string;
  qty: number;
  unit: string;
  remark: string;
  transDate: string;
}

interface CreateMiscReceiptGridColumnsOptions {
  t: TFunction;
}

export function createMiscReceiptGridColumns({
  t,
}: CreateMiscReceiptGridColumnsOptions): ColumnDef<MiscReceiptRecord>[] {
  return [
    {
      accessorKey: "transDate", header: t("material.miscReceipt.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("material.miscReceipt.transNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
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
      accessorKey: "warehouseName", header: t("material.miscReceipt.warehouse"), size: 110,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "qty", header: t("material.miscReceipt.qty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="text-green-600 dark:text-green-400 font-medium">
          +{row.original.qty.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "remark", header: t("material.miscReceipt.remark"), size: 180,
      meta: { filterType: "text" as const },
    },
  ];
}
