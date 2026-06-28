"use client";

import type { TFunction } from "i18next";
import { Link2, Unlink, Wrench, History, CheckCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button, ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface ConsumableItem {
  consumableCode: string;
  consumableName: string;
  category: string;
  operStatus: string;
  mountedEquipCode: string | null;
  status: string;
  currentCount: number;
  expectedLife: number | null;
  location: string | null;
}

type ActionType = "mount" | "unmount" | "repair" | "completeRepair" | null;

export interface CreateConsumableMountGridColumnsOptions {
  t: TFunction;
  onAction: (type: ActionType, item: ConsumableItem) => void;
  onHistory: (item: ConsumableItem) => void;
}

export function createConsumableMountGridColumns({
  t,
  onAction,
  onHistory,
}: CreateConsumableMountGridColumnsOptions): ColumnDef<ConsumableItem>[] {
  return [
    {
      id: "actions", header: t("common.manage"), size: 140, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-1">
            {item.operStatus === "WAREHOUSE" && (
              <Button size="sm" variant="secondary" onClick={() => onAction("mount", item)} title={t("consumables.mount.mountAction")}>
                <Link2 className="w-3 h-3" />
              </Button>
            )}
            {item.operStatus === "MOUNTED" && (
              <Button size="sm" variant="secondary" onClick={() => onAction("unmount", item)} title={t("consumables.mount.unmountAction")}>
                <Unlink className="w-3 h-3" />
              </Button>
            )}
            {item.operStatus !== "REPAIR" && (
              <Button size="sm" variant="secondary" onClick={() => onAction("repair", item)} title={t("consumables.mount.repairAction")}>
                <Wrench className="w-3 h-3" />
              </Button>
            )}
            {item.operStatus === "REPAIR" && (
              <Button size="sm" variant="secondary" onClick={() => onAction("completeRepair", item)} title={t("consumables.mount.completeRepairAction")}>
                <CheckCircle className="w-3 h-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onHistory(item)} title={t("consumables.mount.historyAction")}>
              <History className="w-3 h-3" />
            </Button>
          </div>
        );
      },
    },
    { accessorKey: "operStatus", header: () => <StatusHeaderHelp label={t("consumables.mount.operStatus")} codeType="CONSUMABLE_OPER_STATUS" align="center" />, size: 80, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <StatusBadge codeType="CONSUMABLE_OPER_STATUS" value={getValue() as string} /> },
    { accessorKey: "consumableCode", header: t("consumables.comp.consumableCode"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "consumableName", header: t("consumables.comp.consumableName"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "category", header: t("consumables.comp.category"), size: 80, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} /> },
    { accessorKey: "mountedEquipCode", header: t("consumables.mount.mountedEquip"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("consumables.mount.lifeStatus")} codeType="CONSUMABLE_STATUS" align="center" />, size: 80, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_STATUS" code={getValue() as string} /> },
    {
      id: "lifeProgress", header: t("consumables.life.lifeLabel"), size: 100, meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const { currentCount, expectedLife } = row.original;
        const pct = expectedLife ? Math.round((currentCount / expectedLife) * 100) : 0;
        return (
          <div className="flex items-center gap-1.5">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            <span className="text-xs text-text-muted">{pct}%</span>
          </div>
        );
      },
    },
    { accessorKey: "location", header: t("consumables.comp.location"), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
  ];
}
