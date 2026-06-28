"use client";

import type { TFunction } from "i18next";
import { FlaskConical } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

export interface ShelfLifeItem {
  matUid: string;
  itemCode: string;
  itemName?: string | null;
  currentQty?: number | null;
  unit?: string | null;
  expireDate?: string | null;
  expiryStatus: string;
  daysUntilExpiry: number | null;
  vendor?: string | null;
}

const expiryColors: Record<string, string> = {
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
  NEAR_EXPIRY: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
};

interface CreateShelfLifeReinspectGridColumnsOptions {
  t: TFunction;
  onInspect: (item: ShelfLifeItem) => void;
}

export function createShelfLifeReinspectGridColumns({
  t,
  onInspect,
}: CreateShelfLifeReinspectGridColumnsOptions): ColumnDef<ShelfLifeItem>[] {
  return [
    {
      id: "actions", header: t("material.col.inspect", "검사"), size: 100, enableSorting: false,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <button
          className="inline-flex items-center gap-1 rounded border border-primary px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-white"
          onClick={() => onInspect(row.original)}>
          <FlaskConical className="h-3.5 w-3.5" />
          {t("material.shelfLife.reinspect")}
        </button>
      ),
    },
    {
      accessorKey: "matUid", header: "LOT No.", size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    { accessorKey: "itemName", header: t("common.partName"), size: 150, meta: { filterType: "text" as const } },
    {
      accessorKey: "currentQty", header: t("material.shelfLife.currentQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{(row.original.currentQty ?? 0).toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "expireDate", header: t("material.shelfLife.expireDate"), size: 110, meta: { filterType: "date" as const },
      cell: ({ getValue }) => { const v = getValue() as string; return v ? new Date(v).toLocaleDateString() : "-"; },
    },
    {
      accessorKey: "daysUntilExpiry", header: t("material.shelfLife.remainDays"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const days = getValue() as number | null;
        if (days === null) return <span className="text-text-muted">-</span>;
        const cls = days < 0 ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400";
        return <span className={`font-medium ${cls}`}>{days}{t("material.shelfLife.days")}</span>;
      },
    },
    {
      accessorKey: "expiryStatus", header: t("common.status"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const label = getValue() as string;
        const displayName = label === "EXPIRED" ? t("material.shelfLife.expired") : t("material.shelfLife.nearExpiry");
        return <span className={`rounded px-2 py-0.5 text-xs font-medium ${expiryColors[label] || ""}`}>{displayName}</span>;
      },
    },
  ];
}
