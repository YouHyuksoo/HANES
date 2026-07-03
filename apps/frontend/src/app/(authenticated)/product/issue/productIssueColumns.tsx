"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import ComCodeBadge from "@/components/ui/ComCodeBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface ProductIssueTx {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string | null;
  qualityStatus?: string | null;
  qty: number;
  status: string;
  issueType: string | null;
  remark: string | null;
  cancelRefId: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  fromWarehouse?: { warehouseName: string } | null;
  toWarehouse?: { warehouseName: string } | null;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

interface CreateProductIssueGridColumnsOptions {
  t: TFunction;
}

export function createProductIssueGridColumns({
  t,
}: CreateProductIssueGridColumnsOptions): ColumnDef<ProductIssueTx>[] {
  return [
    {
      accessorKey: "transDate", header: t("productMgmt.issue.col.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.issue.col.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType",
      header: () => <StatusHeaderHelp label={t("common.type")} codeType="TRANSACTION_TYPE" align="center" />,
      size: 110,
      cell: ({ getValue }) => <StatusBadge codeType="TRANSACTION_TYPE" value={getValue() as string} />,
    },
    {
      id: "partCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.part?.itemCode || "-"}</span>,
    },
    {
      id: "partName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.itemName || "-",
    },
    {
      id: "warehouse", header: t("productMgmt.issue.col.warehouse"), size: 110,
      cell: ({ row }) => row.original.fromWarehouse?.warehouseName || "-",
    },
    {
      id: "toWarehouse", header: t("productMgmt.issue.col.toWarehouse", "도착창고"), size: 110,
      cell: ({ row }) => row.original.toWarehouse?.warehouseName || "-",
    },
    {
      accessorKey: "qualityStatus",
      header: t("productMgmt.issue.col.qualityStatus", "품질"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v === "DEFECT"
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{t("productMgmt.issue.defectStock", "불량")}</span>
          : <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{t("productMgmt.issue.goodStock", "양품")}</span>;
      },
    },
    {
      accessorKey: "issueType",
      header: () => <StatusHeaderHelp label={t("productMgmt.issue.col.issueType")} codeType="ISSUE_TYPE" align="center" />,
      size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="ISSUE_TYPE" code={v} /> : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "qty", header: t("common.quantity"), size: 100,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const q = row.original.qty;
        const color = q > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return (
          <span className={`font-medium ${color}`}>
            {q > 0 ? "+" : ""}{q.toLocaleString()} {row.original.part?.unit || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80,
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
  ];
}
