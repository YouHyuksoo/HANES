"use client";

import type { TFunction } from "i18next";
import { Send, CheckCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface UsageReport {
  reportNo: string;
  lotEntryNo: string;
  lotMatUid: string;
  matUid: string;
  itemCode: string;
  itemName: string;
  usageQty: number;
  usageDate: string;
  reportDate: string | null;
  jobOrderNo: string | null;
  status: string;
  workerName: string;
}

export interface CreateCustomsUsageGridColumnsOptions {
  t: TFunction;
  onReport: (reportNo: string) => void;
  onConfirm: (reportNo: string) => void;
}

export function createCustomsUsageGridColumns({
  t,
  onReport,
  onConfirm,
}: CreateCustomsUsageGridColumnsOptions): ColumnDef<UsageReport>[] {
  return [
    {
      id: "actions", header: t("common.manage"), size: 80, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === "DRAFT" && (
            <button onClick={() => onReport(row.original.reportNo)} className="p-1 hover:bg-surface rounded" title={t("customs.usage.report")}><Send className="w-4 h-4 text-primary" /></button>
          )}
          {row.original.status === "REPORTED" && (
            <button onClick={() => onConfirm(row.original.reportNo)} className="p-1 hover:bg-surface rounded" title={t("customs.usage.confirm")}><CheckCircle className="w-4 h-4 text-green-500" /></button>
          )}
        </div>
      ),
    },
    { accessorKey: "reportNo", header: t("customs.usage.reportNo"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "matUid", header: t("customs.stock.matUid"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "usageQty", header: t("customs.usage.usageQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => ((getValue() as number) ?? 0).toLocaleString() },
    { accessorKey: "usageDate", header: t("customs.usage.usageDate"), size: 130, meta: { filterType: "date" as const } },
    { accessorKey: "reportDate", header: t("customs.usage.reportDate"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "jobOrderNo", header: t("customs.usage.jobOrder"), size: 110, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="USAGE_REPORT_STATUS" align="center" />, size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="USAGE_REPORT_STATUS" value={getValue() as string} />,
    },
    { accessorKey: "workerName", header: t("customs.usage.worker"), size: 80, meta: { filterType: "text" as const } },
  ];
}
