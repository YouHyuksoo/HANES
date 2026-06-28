"use client";

import type { TFunction } from "i18next";
import { FileSearch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 관리계획서 데이터 타입 */
export interface ControlPlan {
  [key: string]: unknown;
  planNo: string;
  itemCode: string;
  itemName: string;
  revisionNo: number;
  phase: string;
  status: string;
  approvedBy: string;
  createdAt: string;
}

interface CreateControlPlanGridColumnsOptions {
  t: TFunction;
  onSelectRow: (plan: ControlPlan) => void;
}

export function createControlPlanGridColumns({
  t,
  onSelectRow,
}: CreateControlPlanGridColumnsOptions): ColumnDef<ControlPlan>[] {
  return [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); onSelectRow(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "planNo", header: t("quality.controlPlan.planNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("quality.controlPlan.itemCode"), size: 140,
      meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("quality.controlPlan.itemName"), size: 200,
      meta: { filterType: "text" as const } },
    { accessorKey: "revisionNo", header: t("quality.controlPlan.revisionNo"), size: 80,
      cell: ({ getValue }) => <span className="text-text-muted">Rev.{getValue() as number}</span> },
    { accessorKey: "phase", header: t("quality.controlPlan.phase"), size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CP_PHASE" code={getValue() as string} /> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="CP_STATUS" align="center" />, size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CP_STATUS" code={getValue() as string} /> },
    { accessorKey: "approvedBy", header: t("quality.controlPlan.approvedBy"), size: 100,
      meta: { filterType: "text" as const } },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ];
}
