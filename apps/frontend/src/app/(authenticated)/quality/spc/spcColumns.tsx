"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** SPC 관리도 데이터 타입 */
export interface SpcChart {
  chartNo: string;
  itemCode: string;
  processCode: string;
  characteristicName: string;
  chartType: string;
  subgroupSize: number;
  usl: number | null;
  lsl: number | null;
  target: number | null;
  ucl: number | null;
  lcl: number | null;
  cl: number | null;
  dataSource: string;
  sourceInspectItem: string | null;
  status: string;
  createdAt: string;
}

interface CreateSpcGridColumnsOptions {
  t: TFunction;
  onSelectRow: (row: SpcChart) => void;
}

export function createSpcGridColumns({
  t,
  onSelectRow,
}: CreateSpcGridColumnsOptions): ColumnDef<SpcChart>[] {
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
    { accessorKey: "chartNo", header: t("quality.spc.chartNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("quality.spc.itemCode"), size: 140,
      meta: { filterType: "text" as const } },
    { accessorKey: "processCode", header: t("quality.spc.processCode"), size: 100,
      meta: { filterType: "text" as const } },
    { accessorKey: "processName", header: t("master.process.processName"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "characteristicName", header: t("quality.spc.characteristicName"), size: 180,
      meta: { filterType: "text" as const } },
    { accessorKey: "chartType", header: () => <StatusHeaderHelp label={t("quality.spc.chartType")} codeType="SPC_CHART_TYPE" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="SPC_CHART_TYPE" code={getValue() as string} /> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="SPC_STATUS" align="center" />, size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="SPC_STATUS" code={getValue() as string} /> },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ];
}
