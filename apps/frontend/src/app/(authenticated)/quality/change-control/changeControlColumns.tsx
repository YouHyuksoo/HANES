"use client";

/**
 * @file src/app/(authenticated)/quality/change-control/changeControlColumns.tsx
 * @description 4M 변경점관리 DataGrid 컬럼 팩토리 (page.tsx에서 분리)
 */

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 변경점 데이터 타입 */
export interface ChangeOrder {
  changeNo: string;
  changeType: string;
  title: string;
  description: string;
  reason: string;
  riskAssessment: string;
  affectedItems: string;
  affectedProcesses: string;
  priority: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  reviewerCode: string;
  reviewedAt: string;
  reviewComment: string;
  approverCode: string;
  approvedAt: string;
  effectiveDate: string;
  completionDate: string;
  createdAt: string;
}

interface CreateChangeControlGridColumnsOptions {
  t: TFunction;
  onSelectRow: (row: ChangeOrder) => void;
}

export function createChangeControlGridColumns({
  t,
  onSelectRow,
}: CreateChangeControlGridColumnsOptions): ColumnDef<ChangeOrder>[] {
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
    { accessorKey: "changeNo", header: t("quality.change.changeNo"), size: 180,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "changeType", header: t("quality.change.changeType"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CHANGE_TYPE" code={getValue() as string} /> },
    { accessorKey: "title", header: t("common.title"), size: 250, meta: { filterType: "text" as const } },
    { accessorKey: "priority", header: () => <StatusHeaderHelp label={t("quality.change.priority")} codeType="CHANGE_PRIORITY" align="center" />, size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CHANGE_PRIORITY" code={getValue() as string} /> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="CHANGE_STATUS" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CHANGE_STATUS" code={getValue() as string} /> },
    { accessorKey: "requestedBy", header: t("common.requester"), size: 100,
      meta: { filterType: "text" as const } },
    { accessorKey: "effectiveDate", header: t("quality.change.effectiveDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) ?? "-" },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
  ];
}
