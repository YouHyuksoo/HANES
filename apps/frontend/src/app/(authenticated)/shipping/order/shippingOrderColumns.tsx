"use client";

import type { TFunction } from "i18next";
import { Edit2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface ShipOrderLine {
  itemCode: string;
  itemName?: string;
  unit?: string;
  orderQty: number;
  remark?: string;
}

export interface ShipOrder {
  shipOrderNo: string;
  customerName: string;
  customerId: string;
  customerPoNo?: string;
  dueDate: string;
  shipDate: string;
  status: string;
  itemCount: number;
  totalQty: number;
  remark: string;
  items?: ShipOrderLine[];
}

interface CreateShippingOrderGridColumnsOptions {
  t: TFunction;
  onSelectOrder: (order: ShipOrder) => void;
  onEditOrder: (order: ShipOrder) => void;
}

export function createShippingOrderGridColumns({
  t,
  onSelectOrder,
  onEditOrder,
}: CreateShippingOrderGridColumnsOptions): ColumnDef<ShipOrder>[] {
  return [
    { id: "actions", header: "", size: 56, meta: { align: "center" as const, filterType: "none" as const }, cell: ({ row }) => (
      <div className="flex gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectOrder(row.original);
            onEditOrder(row.original);
          }}
          className="p-1 hover:bg-surface rounded"
          title={t("common.edit")}
        >
          <Edit2 className="w-4 h-4 text-primary" />
        </button>
      </div>
    ) },
    { accessorKey: "shipOrderNo", header: t("shipping.shipOrder.shipOrderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.shipOrder.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "customerPoNo", header: t("shipping.shipOrder.customerPoNo", "고객 PO번호"), size: 140, meta: { filterType: "text" as const }, cell: ({ getValue }) => (getValue() as string) || "-" },
    { accessorKey: "dueDate", header: t("shipping.shipOrder.dueDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "shipDate", header: t("shipping.shipOrder.shipDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "itemCount", header: t("shipping.shipOrder.itemCount"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalQty", header: t("common.totalQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="SHIP_ORDER_STATUS" align="center" />, size: 90, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="SHIP_ORDER_STATUS" code={getValue() as string} /> },
  ];
}
