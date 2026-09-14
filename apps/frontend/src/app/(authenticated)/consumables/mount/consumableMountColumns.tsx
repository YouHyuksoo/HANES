"use client";

import type { TFunction } from "i18next";
import { Unlink, Wrench, History, CheckCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button, ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";
import { headerWithHelp } from "./consumableMountFieldHelp";

/** 소모품 실물 롯트 1건 (CONSUMABLE_STOCKS + 마스터 공통정보) */
export interface ConsumableItem {
  conUid: string;
  consumableCode: string;
  consumableName: string;
  category: string;
  /** 실물 롯트 상태 — PENDING / ACTIVE / PROC_WAIT / MOUNTED / REPAIR / SCRAPPED */
  status: string;
  mountedEquipCode: string | null;
  processCode: string | null;
  /** 수명 상태 — NORMAL / WARNING / REPLACE */
  lifeStatus: string | null;
  currentCount: number;
  expectedLife: number | null;
  location: string | null;
}

export type ActionType = "unmount" | "repair" | "completeRepair" | null;

export interface CreateConsumableMountGridColumnsOptions {
  t: TFunction;
  onAction: (type: ActionType, item: ConsumableItem) => void;
  /** 행 클릭과 동일 — 우측 이력 패널을 연다. 버튼 클릭은 행 클릭으로 전파되지 않게 막는다. */
  onHistory: (item: ConsumableItem) => void;
}

export function createConsumableMountGridColumns({
  t,
  onAction,
  onHistory,
}: CreateConsumableMountGridColumnsOptions): ColumnDef<ConsumableItem>[] {
  return [
    {
      id: "actions", header: t("common.manage"), size: 120, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex gap-1">
            {/* 장착은 현장 키오스크 스캔에서만 — 이 화면은 강제 해제/수리 전환만 한다 */}
            {item.status === "MOUNTED" && (
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onAction("unmount", item); }} title={t("consumables.mount.unmountAction")}>
                <Unlink className="w-3 h-3" />
              </Button>
            )}
            {item.status !== "REPAIR" && item.status !== "SCRAPPED" && (
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onAction("repair", item); }} title={t("consumables.mount.repairAction")}>
                <Wrench className="w-3 h-3" />
              </Button>
            )}
            {item.status === "REPAIR" && (
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); onAction("completeRepair", item); }} title={t("consumables.mount.completeRepairAction")}>
                <CheckCircle className="w-3 h-3" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onHistory(item); }} title={t("consumables.mount.historyAction")}>
              <History className="w-3 h-3" />
            </Button>
          </div>
        );
      },
    },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("consumables.mount.lotStatus")} codeType="CON_STOCK_STATUS" align="center" />, size: 90, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <StatusBadge codeType="CON_STOCK_STATUS" value={getValue() as string} /> },
    { accessorKey: "conUid", header: headerWithHelp("conUid", t("consumables.mount.conUid")), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: "consumableCode", header: headerWithHelp("consumableCode", t("consumables.comp.consumableCode")), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "consumableName", header: headerWithHelp("consumableName", t("consumables.comp.consumableName")), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "category", header: headerWithHelp("category", t("consumables.comp.category")), size: 80, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={getValue() as string} /> },
    { accessorKey: "mountedEquipCode", header: headerWithHelp("mountedEquipCode", t("consumables.mount.mountedEquip")), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "processCode", header: headerWithHelp("processCode", t("consumables.mount.processCode")), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "lifeStatus", header: () => <StatusHeaderHelp label={t("consumables.mount.lifeStatus")} codeType="CONSUMABLE_STATUS" align="center" />, size: 90, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CONSUMABLE_STATUS" code={(getValue() as string) || "NORMAL"} /> },
    {
      id: "lifeProgress", header: headerWithHelp("lifeProgress", t("consumables.life.lifeLabel")), size: 110, meta: { filterType: "none" as const },
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
    { id: "usage", header: t("consumables.life.currentExpected"), size: 130, meta: { filterType: "none" as const, align: "right" as const },
      cell: ({ row }) => {
        const { currentCount, expectedLife } = row.original;
        return <span className="text-xs text-text-muted">{currentCount.toLocaleString()} / {expectedLife ? expectedLife.toLocaleString() : "-"}</span>;
      },
    },
    { accessorKey: "location", header: headerWithHelp("location", t("consumables.comp.location")), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
  ];
}
