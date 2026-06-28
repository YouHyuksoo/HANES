"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface ProductTransaction {
  id: string;
  transNo: string;
  transType: string;
  transDate: string;
  itemCode: string;
  itemType: string;
  prdUid: string | null;
  orderNo: string | null;
  processCode: string | null;
  qty: number;
  status: string;
  remark: string | null;
  part?: { itemCode: string; itemName: string; unit: string } | null;
  toWarehouse?: { warehouseName: string } | null;
  fromWarehouse?: { warehouseName: string } | null;
}

interface CreateProductReceiveGridColumnsOptions {
  t: TFunction;
}

export function createProductReceiveGridColumns({
  t,
}: CreateProductReceiveGridColumnsOptions): ColumnDef<ProductTransaction>[] {
  return [
    {
      accessorKey: "transDate", header: t("productMgmt.receive.col.transDate"), size: 100,
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "transNo", header: t("productMgmt.receive.col.transNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "transType", header: t("common.type"), size: 90,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const cancel = v.includes("CANCEL");
        const label = t(`comCode.TRANSACTION_TYPE.${v}`, { defaultValue: v });
        return (
          <span className={`px-2 py-0.5 rounded text-xs ${cancel ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"}`}>
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
      id: "warehouse", header: t("productMgmt.receive.col.warehouse"), size: 110,
      cell: ({ row }) =>
        row.original.toWarehouse?.warehouseName ||
        row.original.fromWarehouse?.warehouseName ||
        "-",
    },
    {
      accessorKey: "qty", header: t("common.quantity"), size: 90,
      meta: { align: "right" as const },
      cell: ({ row }) => {
        const q = row.original.qty;
        const c = q > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return (
          <span className={`font-medium ${c}`}>
            {q > 0 ? "+" : ""}{q.toLocaleString()} {row.original.part?.unit || ""}
          </span>
        );
      },
    },
    {
      accessorKey: "orderNo", header: t("productMgmt.receive.col.jobOrderId"), size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="PROD_RESULT_STATUS" />, size: 90,
      cell: ({ getValue }) => <StatusBadge codeType="PROD_RESULT_STATUS" value={getValue() as string} />,
    },
  ];
}
