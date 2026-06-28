"use client";

import type { TFunction } from "i18next";
import { FileSearch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 내부심사 데이터 타입 */
export interface Audit {
  auditNo: string; auditType: string; auditScope: string;
  targetDept: string; auditor: string; coAuditor: string;
  scheduledDate: string; actualDate: string; status: string;
  overallResult: string; summary: string; createdAt: string;
}

interface CreateAuditGridColumnsOptions {
  t: TFunction;
  onSelect: (audit: Audit) => void;
}

export function createAuditGridColumns({
  t,
  onSelect,
}: CreateAuditGridColumnsOptions): ColumnDef<Audit>[] {
  return [
      {
        id: "actions", header: "", size: 60,
        meta: { align: "center" as const, filterType: "none" as const },
        cell: ({ row }) => (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(row.original); }}
            className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
          >
            <FileSearch className="w-4 h-4 text-primary" />
          </button>
        ),
      },
      {
        accessorKey: "auditNo",
        header: t("quality.audit.auditNo"),
        size: 160,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="text-primary font-medium">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "auditType",
        header: () => <StatusHeaderHelp label={t("quality.audit.auditType")} codeType="AUDIT_TYPE" align="center" />,
        size: 120,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="AUDIT_TYPE" code={getValue() as string} />
        ),
      },
      {
        accessorKey: "auditScope",
        header: t("quality.audit.auditScope"),
        size: 180,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "targetDept",
        header: t("quality.audit.targetDept"),
        size: 120,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "auditor",
        header: t("quality.audit.auditor"),
        size: 100,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "scheduledDate",
        header: t("quality.audit.scheduledDate"),
        size: 120,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => (getValue() as string)?.slice(0, 10),
      },
      {
        accessorKey: "status",
        header: () => <StatusHeaderHelp label={t("common.status")} codeType="AUDIT_STATUS" align="center" />,
        size: 110,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="AUDIT_STATUS" code={getValue() as string} />
        ),
      },
      {
        accessorKey: "overallResult",
        header: () => <StatusHeaderHelp label={t("quality.audit.overallResult")} codeType="AUDIT_RESULT" align="center" />,
        size: 110,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return v ? <ComCodeBadge groupCode="AUDIT_RESULT" code={v} /> : "-";
        },
      },
    ];
}
