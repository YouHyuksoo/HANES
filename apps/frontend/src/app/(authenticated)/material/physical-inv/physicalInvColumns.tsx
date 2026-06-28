"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { formatQty, parseQty } from "@/utils/qty";

export interface StockForCount {
  id: string;
  warehouseCode: string;
  itemCode: string;
  itemName?: string;
  matUid?: string;
  qty: number;
  unit?: string;
  lastCountAt?: string;
  /** 사용자 입력 실사수량 */
  countedQty: number | null;
}

interface CreatePhysicalInvGridColumnsOptions {
  t: TFunction;
  updateCountedQty: (id: string, value: number | null) => void;
}

export function createPhysicalInvGridColumns({
  t,
  updateCountedQty,
}: CreatePhysicalInvGridColumnsOptions): ColumnDef<StockForCount>[] {
  return [
    {
      accessorKey: "warehouseCode", header: t("material.physicalInv.warehouse"), size: 100,
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
      accessorKey: "matUid", header: "LOT No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "qty", header: t("material.physicalInv.systemQty"), size: 100,
      cell: ({ row }) => <span>{row.original.qty.toLocaleString()} {row.original.unit || ""}</span>,
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      id: "countedQty", header: t("material.physicalInv.countedQty"), size: 120,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <input
          type="text"
          inputMode="numeric"
          className="w-full px-2 py-1 text-sm border border-border rounded bg-surface text-text text-right focus:outline-none focus:ring-1 focus:ring-primary"
          value={formatQty(row.original.countedQty)}
          placeholder="-"
          onChange={(e) => {
            const v = e.target.value;
            updateCountedQty(row.original.id, v === "" ? null : parseQty(v));
          }}
        />
      ),
    },
    {
      id: "diffQty", header: t("material.physicalInv.diffQty"), size: 90,
      cell: ({ row }) => {
        const { qty, countedQty } = row.original;
        if (countedQty === null) return <span className="text-text-muted">-</span>;
        const diff = countedQty - qty;
        if (diff === 0) return <span className="text-green-600">0</span>;
        const cls = diff > 0 ? "text-blue-600 font-medium" : "text-red-600 font-medium";
        return <span className={cls}>{diff > 0 ? "+" : ""}{diff.toLocaleString()}</span>;
      },
      meta: { filterType: "none" as const, align: "right" as const },
    },
    {
      accessorKey: "lastCountAt", header: t("material.physicalInv.lastCountDate"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : <span className="text-text-muted">-</span>;
      },
    },
  ];
}
