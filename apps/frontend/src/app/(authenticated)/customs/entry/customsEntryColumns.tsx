"use client";

import type { TFunction } from "i18next";
import { Edit2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface CustomsEntry {
  entryNo: string;
  blNo: string;
  invoiceNo: string;
  declarationDate: string;
  clearanceDate: string | null;
  origin: string;
  hsCode: string;
  totalAmount: number;
  currency: string;
  status: string;
  lotCount: number;
}

interface CreateCustomsEntryGridColumnsOptions {
  t: TFunction;
  onEditEntry: (entry: CustomsEntry) => void;
}

export function createCustomsEntryGridColumns({
  t,
  onEditEntry,
}: CreateCustomsEntryGridColumnsOptions): ColumnDef<CustomsEntry>[] {
  return [
    {
      id: "actions", header: t("common.manage"), size: 100, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => onEditEntry(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}><Edit2 className="w-4 h-4 text-primary" /></button>
        </div>
      ),
    },
    { accessorKey: "entryNo", header: t("customs.entry.entryNo"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "blNo", header: t("customs.entry.blNo"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "invoiceNo", header: t("customs.entry.invoiceNo"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "declarationDate", header: t("customs.entry.declarationDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "clearanceDate", header: t("customs.entry.clearanceDate"), size: 100, meta: { filterType: "date" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "origin", header: t("customs.entry.origin"), size: 70, meta: { filterType: "text" as const } },
    { accessorKey: "hsCode", header: t("customs.entry.hsCode"), size: 90, meta: { filterType: "text" as const } },
    { accessorKey: "totalAmount", header: t("customs.entry.amount"), size: 100, meta: { filterType: "number" as const }, cell: ({ row }) => `${row.original.totalAmount.toLocaleString()} ${row.original.currency}` },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="CUSTOMS_ENTRY_STATUS" align="center" />, size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="CUSTOMS_ENTRY_STATUS" value={getValue() as string} />,
    },
    { accessorKey: "lotCount", header: t("customs.entry.lotCount"), size: 70, meta: { filterType: "number" as const } },
  ];
}
