"use client";

import type { TFunction } from "i18next";
import { FileSearch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface FaiRequest {
  faiNo: string; triggerType: string; triggerRef: string;
  itemCode: string; orderNo: string; lineCode: string; sampleQty: number;
  inspectorCode: string; status: string; inspectDate: string;
  result: string; remark: string; approvalCode: string;
  approvedAt: string; createdAt: string;
}

interface CreateFaiGridColumnsOptions {
  t: TFunction;
  onSelectRow: (row: FaiRequest) => void;
}

export function createFaiGridColumns({
  t,
  onSelectRow,
}: CreateFaiGridColumnsOptions): ColumnDef<FaiRequest>[] {
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
    { accessorKey: "faiNo", header: t("quality.fai.faiNo"), size: 170, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "triggerType", header: () => <StatusHeaderHelp label={t("quality.fai.triggerType")} codeType="FAI_TRIGGER_TYPE" align="center" />, size: 130,
      cell: ({ getValue }) => <ComCodeBadge groupCode="FAI_TRIGGER_TYPE" code={getValue() as string} /> },
    { accessorKey: "itemCode", header: t("common.code"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "sampleQty", header: t("quality.fai.sampleQty"), size: 90,
      cell: ({ getValue }) => <span className="font-mono text-right block">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="FAI_STATUS" align="center" />, size: 120, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="FAI_STATUS" code={getValue() as string} /> },
    { accessorKey: "result", header: () => <StatusHeaderHelp label={t("quality.fai.result")} codeType="FAI_RESULT" align="center" />, size: 100,
      cell: ({ getValue }) => { const v = getValue() as string; return v ? <ComCodeBadge groupCode="FAI_RESULT" code={v} /> : "-"; } },
    { accessorKey: "inspectorCode", header: t("quality.fai.inspectorCode"), size: 100 },
    { accessorKey: "createdAt", header: t("common.date"), size: 110, meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ];
}
