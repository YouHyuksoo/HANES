"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface ShipHistory {
  id: string;
  shipOrderNo: string;
  customerName: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
  createdAt: string;
  items?: { itemCode: string; orderQty?: number; shippedQty?: number }[];
}

interface CreateShippingHistoryGridColumnsOptions {
  t: TFunction;
}

export function createShippingHistoryGridColumns({
  t,
}: CreateShippingHistoryGridColumnsOptions): ColumnDef<ShipHistory>[] {
  return [
    { accessorKey: "shipOrderNo", header: t("shipping.history.shipOrderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.history.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "dueDate", header: t("shipping.history.dueDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "shipDate", header: t("shipping.history.shipDateCol"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "itemCount", header: t("shipping.history.itemCount"), size: 70, meta: { filterType: "number" as const } },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 100, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="SHIP_ORDER_STATUS" align="center" />, size: 90, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <StatusBadge codeType="SHIP_ORDER_STATUS" value={getValue() as string} /> },
    { accessorKey: "createdAt", header: t("common.createdAt"), size: 100, meta: { filterType: "date" as const } },
  ];
}
