"use client";

import type { TFunction } from "i18next";
import { RotateCcw } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button, ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface LifeInstance {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  currentCount: number;
  expectedLife: number;
  status: string;
  location: string;
  mountedEquipCode: string | null;
  lastReplaceAt: string | null;
}

const getProgressColor = (pct: number) => {
  if (pct >= 100) return "bg-red-500";
  if (pct >= 80) return "bg-yellow-500";
  return "bg-green-500";
};

interface CreateConsumableLifeGridColumnsOptions {
  t: TFunction;
}

export function createConsumableLifeGridColumns({
  t,
}: CreateConsumableLifeGridColumnsOptions): ColumnDef<LifeInstance>[] {
  return [
    {
      id: "actions", header: t("common.manage"), size: 70, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => row.original.status === "REPLACE" ? (
        <Button size="sm" variant="secondary"><RotateCcw className="w-3 h-3 mr-1" /> {t("consumables.life.replaceAction")}</Button>
      ) : null,
    },
    { accessorKey: "conUid", header: t("consumables.stock.conUid"), size: 150, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span>,
    },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="CONSUMABLE_LIFE_STATUS" align="center" />, size: 60, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <StatusBadge codeType="CONSUMABLE_LIFE_STATUS" value={getValue() as string} /> },
    { accessorKey: "consumableCode", header: t("consumables.master.code"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "consumableName", header: t("consumables.master.name"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "category", header: t("consumables.life.categoryLabel"), size: 70, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} /> },
    { accessorKey: "location", header: t("consumables.life.location"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "mountedEquipCode", header: t("consumables.stock.mountedEquip"), size: 110, meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string | null) ?? "-",
    },
    {
      id: "lifePercentage", header: t("consumables.life.lifeLabel"), size: 100, meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const pct = row.original.expectedLife ? Math.round((row.original.currentCount / row.original.expectedLife) * 100) : 0;
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full ${getProgressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className={`text-xs ${pct >= 100 ? "text-red-600" : pct >= 80 ? "text-yellow-600" : "text-text-muted"}`}>{pct}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "currentCount", header: t("consumables.life.currentExpected"), size: 110, meta: { filterType: "number" as const },
      cell: ({ row }) => <span className="text-xs">{(row.original.currentCount ?? 0).toLocaleString()} / {(row.original.expectedLife ?? 0).toLocaleString()}</span>,
    },
    {
      id: "remainingLife", header: t("consumables.life.remaining"), size: 70, meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const remaining = (row.original.expectedLife ?? 0) - (row.original.currentCount ?? 0);
        return <span className={`text-xs ${remaining < 0 ? "text-red-600 font-medium" : "text-text-muted"}`}>{remaining < 0 ? `+${Math.abs(remaining).toLocaleString()}` : remaining.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "lastReplaceAt", header: t("consumables.life.lastReplaced"), size: 90, meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <span className="text-xs text-text-muted">{v.split("T")[0]}</span> : "-";
      },
    },
  ];
}
