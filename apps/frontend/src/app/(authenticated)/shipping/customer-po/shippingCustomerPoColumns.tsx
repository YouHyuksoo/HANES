"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";
import { type CustomerOrder } from "./components/CustomerPoFormPanel";

export interface CreateShippingCustomerPoGridColumnsOptions {
  t: TFunction;
  onEdit: (order: CustomerOrder) => void;
  onDelete: (order: CustomerOrder) => void;
}

export function createShippingCustomerPoGridColumns({
  t,
  onEdit,
  onDelete,
}: CreateShippingCustomerPoGridColumnsOptions): ColumnDef<CustomerOrder>[] {
  return [
    {
      id: "actions", header: "", size: 80,
      meta: { filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEdit(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "orderNo", header: t("shipping.customerPo.orderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.customerPo.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "orderDate", header: t("shipping.customerPo.orderDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "dueDate", header: t("shipping.customerPo.dueDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "itemCount", header: t("shipping.customerPo.itemCount"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{getValue() as number}</span> },
    { accessorKey: "totalAmount", header: t("shipping.customerPo.totalAmount"), size: 120, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="CUSTOMER_PO_STATUS" align="center" />,
      size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="CUSTOMER_PO_STATUS" value={getValue() as string} />,
    },
  ];
}
