"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface OqcRequest {
  id: string;
  requestNo: string;
  itemCode: string;
  customer: string | null;
  requestDate: string;
  totalBoxCount: number;
  totalQty: number;
  sampleSize: number | null;
  status: string;
  result: string | null;
  inspectorName: string | null;
  inspectDate: string | null;
  remark: string | null;
  part?: { itemCode?: string; itemName?: string };
}

interface CreateOqcGridColumnsOptions {
  t: TFunction;
  onRowAction: (row: OqcRequest) => void;
}

export function createOqcGridColumns({
  t,
  onRowAction,
}: CreateOqcGridColumnsOptions): ColumnDef<OqcRequest>[] {
  return [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); onRowAction(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    {
      accessorKey: "requestNo", header: t("quality.oqc.requestNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span>,
    },
    {
      accessorKey: "requestDate", header: t("quality.oqc.requestDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const d = getValue() as string;
        return d ? new Date(d).toLocaleDateString() : "-";
      },
    },
    {
      accessorFn: (row) => row.part?.itemCode, id: "partCode",
      header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorFn: (row) => row.part?.itemName, id: "partName",
      header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "customer", header: t("quality.oqc.customer"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "totalBoxCount", header: t("quality.oqc.boxCount"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "totalQty", header: t("quality.oqc.totalQty"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "sampleSize", header: t("quality.oqc.sampleSize"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="font-mono text-right block">{v != null ? v.toLocaleString() : "-"}</span>;
      },
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="OQC_STATUS" align="center" />, size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="OQC_STATUS" code={getValue() as string} />,
    },
    {
      accessorKey: "inspectorName", header: t("quality.oqc.inspector"), size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
  ];
}
