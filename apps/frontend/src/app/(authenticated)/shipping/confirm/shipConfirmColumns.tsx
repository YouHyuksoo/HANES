"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface CandidateBox {
  boxNo: string;
  itemCode: string;
  qty: number;
  oqcStatus?: string | null;
}

interface CreateShipConfirmGridColumnsOptions {
  t: TFunction;
}

export function createShipConfirmGridColumns({
  t,
}: CreateShipConfirmGridColumnsOptions): ColumnDef<CandidateBox>[] {
  return [
    { accessorKey: "boxNo", header: t("shipping.confirm.boxNo", "박스번호"), size: 190, meta: { filterType: "text" as const }, cell: ({ getValue }) => <span className="font-mono font-medium">{getValue() as string}</span> },
    { accessorKey: "itemCode", header: t("shipping.confirm.item", "품목"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("shipping.confirm.qty", "수량"), size: 90, meta: { align: "right" as const, filterType: "number" as const }, cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span> },
    { accessorKey: "oqcStatus", header: () => <StatusHeaderHelp label="OQC" codeType="OQC_STATUS" align="center" />, size: 80, meta: { align: "center" as const }, cell: ({ getValue }) => <StatusBadge codeType="OQC_STATUS" value={getValue() as string} /> },
  ];
}
