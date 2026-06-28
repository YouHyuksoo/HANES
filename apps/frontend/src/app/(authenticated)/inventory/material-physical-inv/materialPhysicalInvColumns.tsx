"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

interface StockForCount {
  id: string;
  warehouseCode: string;
  itemCode: string;
  itemName?: string;
  matUid?: string;
  qty: number;
  unit?: string;
  lastCountAt?: string;
  countedQty: number | null;
}

interface CreateMaterialPhysicalInvGridColumnsOptions {
  t: TFunction;
}

export function createMaterialPhysicalInvGridColumns({
  t,
}: CreateMaterialPhysicalInvGridColumnsOptions): ColumnDef<StockForCount>[] {
  return [
    { accessorKey: "warehouseName", header: t("material.physicalInv.warehouse"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span> },
    { accessorKey: "itemName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "matUid", header: t("material.physicalInv.matSerial"), size: 150, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "-"}</span> },
    { accessorKey: "qty", header: t("material.physicalInv.systemQty"), size: 100, meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{row.original.qty.toLocaleString()} {row.original.unit || ""}</span> },
    { id: "countedQty", header: t("material.physicalInv.countedQty"), size: 110, meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        row.original.countedQty === null
          ? <span className="text-text-muted">-</span>
          : <span className="font-medium">{row.original.countedQty.toLocaleString()}</span>
      ) },
    { id: "diffQty", header: t("material.physicalInv.diffQty"), size: 90, meta: { align: "right" as const },
      cell: ({ row }) => {
        const { qty, countedQty } = row.original;
        if (countedQty === null) return <span className="text-text-muted">-</span>;
        const diff = countedQty - qty;
        if (diff === 0) return <span className="text-green-600 dark:text-green-400">0</span>;
        return <span className={diff > 0 ? "text-blue-600 dark:text-blue-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
          {diff > 0 ? "+" : ""}{diff.toLocaleString()}</span>;
      } },
    { accessorKey: "countedAt", header: t("material.physicalInv.countedAt"), size: 140, meta: { filterType: "date" as const },
      cell: ({ getValue }) => { const v = getValue() as string; return v ? new Date(v).toLocaleString() : <span className="text-text-muted">-</span>; } },
    { accessorKey: "lastCountAt", header: t("material.physicalInv.lastCountDate"), size: 110, meta: { filterType: "date" as const },
      cell: ({ getValue }) => { const v = getValue() as string; return v ? new Date(v).toLocaleDateString() : <span className="text-text-muted">-</span>; } },
  ];
}
