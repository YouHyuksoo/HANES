"use client";

import type { TFunction } from "i18next";
import { XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";

export interface ReceiptTransaction {
  id: string;
  transNo: string;
  transType: string;
  itemCode: string;
  itemName: string;
  matUid: string;
  vendorName?: string | null;
  warehouseName: string;
  qty: number;
  unit: string;
  transDate: string;
  status: string;
  cancelRefId?: string;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

interface CreateReceiptCancelGridColumnsOptions {
  t: TFunction;
  setSelectedTx: (tx: ReceiptTransaction | null) => void;
  setReason: (reason: string) => void;
  setIsModalOpen: (open: boolean) => void;
}

export function createReceiptCancelGridColumns({
  t,
  setSelectedTx,
  setReason,
  setIsModalOpen,
}: CreateReceiptCancelGridColumnsOptions): ColumnDef<ReceiptTransaction>[] {
  return [
    {
      id: "actions", header: "", size: 90, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        if (row.original.status === "CANCELED" || row.original.cancelRefId) return null;
        return (
          <Button size="sm" className="!h-6 !px-2 !text-xs !gap-1 !rounded-md" variant="secondary" onClick={() => {
            setSelectedTx(row.original);
            setReason("");
            setIsModalOpen(true);
          }}>
            <XCircle className="w-4 h-4 mr-1" />{t("material.receiptCancel.cancel")}
          </Button>
        );
      },
    },
    {
      accessorKey: "transDate", header: t("material.receiptCancel.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("material.receiptCancel.transNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("material.receiptCancel.transType"), size: 90, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "matUid", header: "LOT No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "vendorName", header: t("material.arrivalResult.supplier", "공급사"), size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.vendorName || "-",
    },
    {
      accessorKey: "warehouseName", header: t("material.receiptCancel.warehouse"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "qty", header: t("material.receiptCancel.qty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="font-medium text-green-600 dark:text-green-400">
          +{row.original.qty.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "status", header: t("common.status"), size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s] || ""}`}>{s}</span>;
      },
    },
  ];
}
