"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface ArrivalTransactionRow {
  transNo: string;
  transType: "ARRIVAL_IN" | "ARRIVAL_CANCEL" | string;
  transDate: string;
  arrivalNo?: string | null;
  invoiceNo?: string | null;
  vendorName?: string | null;
  itemCode: string;
  itemName?: string | null;
  unit?: string | null;
  matUid?: string | null;
  qty: number;
  warehouseCode?: string | null;
  warehouseName?: string | null;
  refType?: string | null;
  refId?: string | null;
  cancelRefId?: string | null;
  workerId?: string | null;
  status: string;
  remark?: string | null;
  part?: { itemCode?: string; itemName?: string; unit?: string } | null;
  lot?: { matUid?: string; poNo?: string | null } | null;
  toWarehouse?: { warehouseCode?: string; warehouseName?: string } | null;
}

const getTransTypeClassName = (type: string) => {
  if (type === "ARRIVAL_CANCEL") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }
  if (type === "ARRIVAL_IN") {
    return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";
};

const getStatusClassName = (status: string) => {
  if (status === "DONE") {
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  }
  if (status === "CANCELED") {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-700/50 dark:text-gray-300";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const getSignedQty = (row: ArrivalTransactionRow) => {
  const qty = Number(row.qty ?? 0);
  return row.transType === "ARRIVAL_CANCEL" ? -Math.abs(qty) : qty;
};

interface CreateArrivalTransactionGridColumnsOptions {
  t: TFunction;
  getTransTypeLabel: (type: string) => string;
}

export function createArrivalTransactionGridColumns({
  t,
  getTransTypeLabel,
}: CreateArrivalTransactionGridColumnsOptions): ColumnDef<ArrivalTransactionRow>[] {
  return [
    {
      accessorKey: "transDate",
      header: t("material.arrivalTransaction.col.transDate", "거래일시"),
      size: 160,
      meta: { filterType: "date" as const },
      cell: ({ row }) => formatDateTime(row.original.transDate),
    },
    {
      accessorKey: "transNo",
      header: t("material.arrivalTransaction.col.transNo", "거래번호"),
      size: 170,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "transType",
      header: t("common.type"),
      size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getTransTypeClassName(row.original.transType)}`}>
          {getTransTypeLabel(row.original.transType)}
        </span>
      ),
    },
    {
      accessorKey: "arrivalNo",
      header: t("material.arrivalTransaction.col.arrivalNo", "입하번호"),
      size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.arrivalNo || row.original.refId || "-",
    },
    {
      accessorKey: "vendorName",
      header: t("material.arrivalTransaction.col.vendor", "공급사"),
      size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.vendorName || "-",
    },
    {
      accessorKey: "itemCode",
      header: t("common.partCode"),
      size: 130,
      meta: { filterType: "text" as const },
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.part?.itemCode || row.original.itemCode}
        </span>
      ),
    },
    {
      accessorKey: "itemName",
      header: t("common.partName"),
      size: 180,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.part?.itemName || row.original.itemName || "-",
    },
    {
      accessorKey: "matUid",
      header: "MAT UID",
      size: 170,
      meta: { filterType: "text" as const },
      cell: ({ row }) => (
        <span className="font-mono text-sm">
          {row.original.lot?.matUid || row.original.matUid || "-"}
        </span>
      ),
    },
    {
      accessorKey: "qty",
      header: t("common.quantity"),
      size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => {
        const signedQty = getSignedQty(row.original);
        const unit = row.original.part?.unit || row.original.unit || "";
        return (
          <span className={signedQty < 0 ? "font-semibold text-red-600 dark:text-red-400" : "font-semibold text-blue-600 dark:text-blue-400"}>
            {signedQty > 0 ? "+" : ""}
            {signedQty.toLocaleString()} {unit}
          </span>
        );
      },
    },
    {
      accessorKey: "warehouseName",
      header: t("material.arrivalTransaction.col.warehouse", "입하창고"),
      size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.toWarehouse?.warehouseName || row.original.warehouseName || row.original.warehouseCode || "-",
    },
    {
      accessorKey: "refType",
      header: t("material.arrivalTransaction.col.reference", "참조"),
      size: 150,
      meta: { filterType: "text" as const },
      cell: ({ row }) => {
        const ref = [row.original.refType, row.original.refId].filter(Boolean).join(" / ");
        return ref || "-";
      },
    },
    {
      accessorKey: "workerId",
      header: t("material.arrivalTransaction.col.worker", "작업자"),
      size: 100,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.workerId || "-",
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusClassName(row.original.status)}`}>
          {row.original.status === "DONE"
            ? t("material.arrivalTransaction.statusDone", "완료")
            : row.original.status === "CANCELED"
              ? t("material.arrivalTransaction.statusCanceled", "취소")
              : row.original.status}
        </span>
      ),
    },
    {
      accessorKey: "remark",
      header: t("common.remark"),
      size: 180,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.remark || "-",
    },
  ];
}
