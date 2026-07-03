"use client";

import type { TFunction } from "i18next";
import { ArchiveRestore, XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface ProductDefectStock {
  itemCode: string;
  itemName: string | null;
  itemType: "SEMI_PRODUCT" | "FINISHED";
  qualityStatus: "DEFECT";
  warehouseCode: string;
  warehouseName: string | null;
  availableQty: number;
  qty: number;
  unit: string | null;
}

export interface ProductDefectTransferTx {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string | null;
  qualityStatus?: string | null;
  qty: number;
  status: string;
  cancelRefId: string | null;
  remark: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  fromWarehouse?: { warehouseName: string } | null;
  toWarehouse?: { warehouseName: string } | null;
}

const statusColors: Record<string, string> = {
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  CANCELED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

interface CreateProductDefectTransferGridColumnsOptions {
  t: TFunction;
  onCancelTx: (tx: ProductDefectTransferTx) => void;
}

interface CreateProductDefectTargetGridColumnsOptions {
  t: TFunction;
  onTransferStock: (stock: ProductDefectStock) => void;
}

export function createProductDefectTargetGridColumns({
  t,
  onTransferStock,
}: CreateProductDefectTargetGridColumnsOptions): ColumnDef<ProductDefectStock>[] {
  return [
    {
      id: "actions",
      header: "",
      size: 90,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <Button size="sm" onClick={() => onTransferStock(row.original)} disabled={row.original.availableQty <= 0}>
          <ArchiveRestore className="w-4 h-4 mr-1" />{t("productMgmt.defectTransfer.register")}
        </Button>
      ),
    },
    {
      accessorKey: "itemCode",
      header: t("common.partCode"),
      size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "itemName",
      header: t("common.partName"),
      size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "warehouseName",
      header: t("productMgmt.defectTransfer.col.sourceWarehouse"),
      size: 130,
      cell: ({ row }) => row.original.warehouseName || row.original.warehouseCode,
    },
    {
      accessorKey: "qualityStatus",
      header: t("productMgmt.defectTransfer.col.qualityStatus"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: () => (
        <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {t("productMgmt.defectTransfer.defectStock")}
        </span>
      ),
    },
    {
      accessorKey: "availableQty",
      header: t("common.available"),
      size: 100,
      meta: { align: "right" as const },
      cell: ({ row }) => (
        <span className="font-medium text-red-600 dark:text-red-400">
          {row.original.availableQty.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
  ];
}

export function createProductDefectHistoryGridColumns({
  t,
  onCancelTx,
}: CreateProductDefectTransferGridColumnsOptions): ColumnDef<ProductDefectTransferTx>[] {
  return [
    {
      id: "actions",
      header: "",
      size: 90,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const tx = row.original;
        if (tx.status === "CANCELED" || tx.cancelRefId || tx.transType.includes("CANCEL")) return null;
        return (
          <Button size="sm" variant="secondary" onClick={() => onCancelTx(tx)}>
            <XCircle className="w-4 h-4 mr-1" />{t("productMgmt.defectTransfer.cancel")}
          </Button>
        );
      },
    },
    {
      accessorKey: "transDate",
      header: t("productMgmt.defectTransfer.col.transDate"),
      size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo",
      header: t("productMgmt.defectTransfer.col.transNo"),
      size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType",
      header: () => <StatusHeaderHelp label={t("productMgmt.defectTransfer.col.transType")} codeType="TRANSACTION_TYPE" align="center" />,
      size: 120,
      cell: ({ getValue }) => <StatusBadge codeType="TRANSACTION_TYPE" value={getValue() as string} />,
    },
    {
      id: "partCode",
      header: t("common.partCode"),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.part?.itemCode || "-"}</span>,
    },
    {
      id: "partName",
      header: t("common.partName"),
      size: 160,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.itemName || "-",
    },
    {
      id: "fromWarehouse",
      header: t("productMgmt.defectTransfer.col.sourceWarehouse"),
      size: 120,
      cell: ({ row }) => row.original.fromWarehouse?.warehouseName || "-",
    },
    {
      id: "toWarehouse",
      header: t("productMgmt.defectTransfer.col.targetWarehouse"),
      size: 120,
      cell: ({ row }) => row.original.toWarehouse?.warehouseName || "-",
    },
    {
      accessorKey: "qualityStatus",
      header: t("productMgmt.defectTransfer.col.qualityStatus"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value === "DEFECT"
          ? <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{t("productMgmt.defectTransfer.defectStock")}</span>
          : <span className="text-text-muted">-</span>;
      },
    },
    {
      accessorKey: "qty",
      header: t("productMgmt.defectTransfer.col.qty"),
      size: 100,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const qty = row.original.qty;
        const color = qty > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return (
          <span className={`font-medium ${color}`}>
            {qty > 0 ? "+" : ""}{qty.toLocaleString()} {row.original.part?.unit || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      size: 80,
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || ""}`}>{status}</span>;
      },
    },
  ];
}
