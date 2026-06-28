"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface CustomerPoStatus {
  id: string;
  orderNo: string;
  customerName: string;
  orderDate: string;
  dueDate: string;
  orderQty: number;
  shippedQty: number;
  shipRate: number;
  remainQty: number;
  status: string;
}

interface CreateShippingCustomerPoStatusGridColumnsOptions {
  t: TFunction;
}

export function createShippingCustomerPoStatusGridColumns({
  t,
}: CreateShippingCustomerPoStatusGridColumnsOptions): ColumnDef<CustomerPoStatus>[] {
  return [
    { accessorKey: "orderNo", header: t("shipping.customerPoStatus.orderNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "customerName", header: t("shipping.customerPoStatus.customer"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "dueDate", header: t("shipping.customerPoStatus.dueDate"), size: 100, meta: { filterType: "date" as const } },
    { accessorKey: "orderQty", header: t("shipping.customerPoStatus.orderQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "shippedQty", header: t("shipping.customerPoStatus.shippedQty"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    {
      accessorKey: "shipRate", header: t("shipping.customerPoStatus.shipRate"), size: 100,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        const barColor = rate >= 100 ? "bg-green-500" : rate >= 50 ? "bg-blue-500" : rate > 0 ? "bg-orange-500" : "bg-gray-300 dark:bg-gray-600";
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "remainQty", header: t("shipping.customerPoStatus.remainQty"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => { const qty = getValue() as number; return <span className={`font-medium ${qty > 0 ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>{qty.toLocaleString()}</span>; },
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="CUSTOMER_PO_PROGRESS" align="center" />,
      size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="CUSTOMER_PO_PROGRESS" value={getValue() as string} />,
    },
  ];
}
