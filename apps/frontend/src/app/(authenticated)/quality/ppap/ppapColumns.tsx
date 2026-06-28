"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch } from "lucide-react";
import { ComCodeBadge, Badge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** PPAP 데이터 타입 */
export interface PpapSubmission {
  ppapNo: string;
  itemCode: string;
  itemName: string;
  customerCode: string;
  customerName: string;
  ppapLevel: number;
  reason: string;
  status: string;
  completionRate: number;
  remark: string;
  submittedAt: string;
  approvedAt: string;
  rejectedAt: string;
  rejectReason: string;
  createdAt: string;
}

interface CreatePpapGridColumnsOptions {
  t: TFunction;
  onViewDetail: (row: PpapSubmission) => void;
}

export function createPpapGridColumns({
  t,
  onViewDetail,
}: CreatePpapGridColumnsOptions): ColumnDef<PpapSubmission>[] {
  return [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); onViewDetail(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "ppapNo", header: t("quality.ppap.ppapNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("quality.ppap.itemCode"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("quality.ppap.itemName"), size: 200, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("quality.ppap.customerName"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "ppapLevel", header: t("quality.ppap.ppapLevel"), size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <Badge variant="info">Level {getValue() as number}</Badge>
      ),
    },
    { accessorKey: "reason", header: () => <StatusHeaderHelp label={t("quality.ppap.reason")} codeType="PPAP_REASON" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PPAP_REASON" code={getValue() as string} /> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="PPAP_STATUS" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="PPAP_STATUS" code={getValue() as string} /> },
    { accessorKey: "completionRate", header: t("quality.ppap.completionRate"), size: 110,
      cell: ({ getValue }) => {
        const rate = (getValue() as number) ?? 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${rate === 100 ? "bg-green-500" : "bg-blue-500"}`}
                style={{ width: `${rate}%` }} />
            </div>
            <span className="text-xs font-medium text-text-muted w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ];
}
