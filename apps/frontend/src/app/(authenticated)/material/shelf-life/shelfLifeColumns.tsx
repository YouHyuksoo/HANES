"use client";

import type { TFunction } from "i18next";
import { FlaskConical } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";

export interface ShelfLifeItem {
  matUid: string;
  itemCode?: string;
  itemName?: string;
  currentQty: number;
  unit?: string;
  expireDate?: string;
  expiryStatus: string;
  daysUntilExpiry: number | null;
  vendor?: string;
  vendorName?: string | null;
  status?: string;
}

const expiryColors: Record<string, string> = {
  EXPIRED: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-300",
  NEAR_EXPIRY: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/60 dark:text-yellow-300",
  VALID: "text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700",
  DISCARDED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

interface CreateShelfLifeGridColumnsOptions {
  t: TFunction;
  onReinspect: (matUid: string) => void;
}

export function createShelfLifeGridColumns({
  t,
  onReinspect,
}: CreateShelfLifeGridColumnsOptions): ColumnDef<ShelfLifeItem>[] {
  return [
    {
      accessorKey: "matUid", header: "LOT No.", size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
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
      accessorKey: "currentQty", header: t("material.shelfLife.currentQty"), size: 110,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{(row.original.currentQty ?? 0).toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "vendor", header: t("material.shelfLife.vendor"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span>{row.original.vendorName || row.original.vendor || "-"}</span>,
    },
    {
      accessorKey: "expireDate", header: t("material.shelfLife.expireDate"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : "-";
      },
    },
    {
      accessorKey: "daysUntilExpiry", header: t("material.shelfLife.remainDays"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row, getValue }) => {
        if (row.original.expiryStatus === "DISCARDED") return <span className="text-text-muted">-</span>;
        const days = getValue() as number | null;
        if (days === null) return <span className="text-text-muted">-</span>;
        const cls = days < 0 ? "text-red-600 dark:text-red-400" : days <= 10 ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400";
        return <span className={`font-medium ${cls}`}>{days}{t("material.shelfLife.days")}</span>;
      },
    },
    {
      accessorKey: "expiryStatus", header: t("common.status"), size: 100, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const label = getValue() as string;
        const displayName = label === "EXPIRED" ? t("material.shelfLife.expired")
          : label === "NEAR_EXPIRY" ? t("material.shelfLife.nearExpiry")
          : label === "DISCARDED" ? t("material.shelfLife.discarded")
          : t("material.shelfLife.valid");
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${expiryColors[label] || ""}`}>{displayName}</span>;
      },
    },
    {
      id: "actions", header: "", size: 80, enableSorting: false,
      cell: ({ row }) => {
        const item = row.original;
        const canReinspect = item.expiryStatus === "EXPIRED" || item.expiryStatus === "NEAR_EXPIRY";
        if (!canReinspect) return null;
        return (
          <Button size="sm" variant="secondary" className="h-6 px-2 text-xs"
            onClick={() => onReinspect(item.matUid)}>
            <FlaskConical className="w-3 h-3 mr-1" />{t("material.shelfLife.reinspect")}
          </Button>
        );
      },
    },
  ];
}
