"use client";

import type { TFunction } from "i18next";
import { XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface ProductReceiptTx {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string | null;
  qty: number;
  status: string;
  refType?: string | null;
  cancelRefId: string | null;
  remark: string | null;
  orderNo: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  toWarehouse?: { warehouseName: string } | null;
  fromWarehouse?: { warehouseName: string } | null;
}

interface CreateProductReceiptCancelGridColumnsOptions {
  t: TFunction;
  setSelectedTx: (tx: ProductReceiptTx | null) => void;
  setReason: (reason: string) => void;
  setIsModalOpen: (open: boolean) => void;
}

export function createProductReceiptCancelGridColumns({
  t,
  setSelectedTx,
  setReason,
  setIsModalOpen,
}: CreateProductReceiptCancelGridColumnsOptions): ColumnDef<ProductReceiptTx>[] {
  return [
    {
      id: "actions", header: "", size: 90,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const tx = row.original;
        if (tx.status === "CANCELED" || tx.cancelRefId || tx.transType.includes("CANCEL")) return null;
        return (
          <Button size="sm" variant="secondary" onClick={() => {
            setSelectedTx(tx);
            setReason("");
            setIsModalOpen(true);
          }}>
            <XCircle className="w-4 h-4 mr-1" />{t("productMgmt.receiptCancel.cancel")}
          </Button>
        );
      },
    },
    {
      accessorKey: "transDate", header: t("productMgmt.receiptCancel.transDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.receiptCancel.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("productMgmt.receiptCancel.transType"), size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const isCancelType = v.includes("CANCEL");
        const label = t(`comCode.TRANSACTION_TYPE.${v}`, { defaultValue: v });
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${isCancelType ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"}`}>
            {label}
          </span>
        );
      },
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
      id: "warehouse", header: t("productMgmt.receiptCancel.warehouse"), size: 110,
      cell: ({ row }) =>
        row.original.toWarehouse?.warehouseName ||
        row.original.fromWarehouse?.warehouseName ||
        "-",
    },
    {
      accessorKey: "qty", header: t("productMgmt.receiptCancel.qty"), size: 100,
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
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="PROD_RESULT_STATUS" />, size: 90,
      cell: ({ getValue }) => <StatusBadge codeType="PROD_RESULT_STATUS" value={getValue() as string} />,
    },
  ];
}
