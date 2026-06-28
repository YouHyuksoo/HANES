"use client";

import type { TFunction } from "i18next";
import { FileSearch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import type { ReworkEditData } from "./components/ReworkFormPanel";

/** 재작업 지시 데이터 타입 */
export interface ReworkOrder extends ReworkEditData {
  status: string;
  resultQty: number;
  passQty: number;
  failQty: number;
  createdAt: string;
}

export interface CreateReworkGridColumnsOptions {
  t: TFunction;
  onSelectRow: (row: ReworkOrder) => void;
}

export function createReworkGridColumns({
  t,
  onSelectRow,
}: CreateReworkGridColumnsOptions): ColumnDef<ReworkOrder>[] {
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
    { accessorKey: "reworkNo", header: t("quality.rework.reworkNo"), size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("quality.rework.itemCode"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("quality.rework.itemName"), size: 180, meta: { filterType: "text" as const } },
    { accessorKey: "reworkQty", header: t("quality.rework.reworkQty"), size: 90, meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "defectType", header: t("quality.rework.defectType"), size: 110, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="DEFECT_TYPE" code={getValue() as string} /> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="REWORK_STATUS" align="center" />, size: 120, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="REWORK_STATUS" code={getValue() as string} /> },
    { accessorKey: "workerId", header: t("quality.rework.worker"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 140, meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ];
}
