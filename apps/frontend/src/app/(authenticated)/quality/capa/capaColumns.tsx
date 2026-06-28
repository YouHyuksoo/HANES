"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface CapaRequest {
  [key: string]: unknown;
  capaNo: string; capaType: string; sourceType: string;
  title: string; description: string; rootCause: string; actionPlan: string;
  targetDate: string; responsibleCode: string; status: string; priority: string;
  verificationResult: string; itemCode: string; lineCode: string; createdAt: string;
}

interface CreateCapaGridColumnsOptions {
  t: TFunction;
  onSelectRow: (row: CapaRequest) => void;
}

export function createCapaGridColumns({
  t,
  onSelectRow,
}: CreateCapaGridColumnsOptions): ColumnDef<CapaRequest>[] {
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
    { accessorKey: "capaNo", header: t("quality.capa.capaNo"), size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "capaType", header: t("quality.capa.capaType"), size: 100,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAPA_TYPE" code={getValue() as string} /> },
    { accessorKey: "sourceType", header: t("quality.capa.sourceType"), size: 110,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAPA_SOURCE_TYPE" code={getValue() as string} /> },
    { accessorKey: "title", header: t("quality.capa.title"), size: 220, meta: { filterType: "text" as const } },
    { accessorKey: "priority", header: () => <StatusHeaderHelp label={t("common.priority")} codeType="CHANGE_PRIORITY" align="center" />, size: 90,
      cell: ({ getValue }) => getValue() ? <ComCodeBadge groupCode="CHANGE_PRIORITY" code={getValue() as string} /> : "-" },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="CAPA_STATUS" align="center" />, size: 120,
      cell: ({ getValue }) => <ComCodeBadge groupCode="CAPA_STATUS" code={getValue() as string} /> },
    { accessorKey: "responsibleCode", header: t("quality.capa.responsible"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "targetDate", header: t("quality.capa.targetDate"), size: 110,
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 110, meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ];
}
