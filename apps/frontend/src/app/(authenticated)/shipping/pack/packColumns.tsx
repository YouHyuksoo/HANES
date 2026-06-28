"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import { BoxStatusBadge } from "@/components/shipping";
import type { BoxStatus } from "@/components/shipping";

/** 박스 (백엔드 BOX_MASTERS 자연키 boxNo, 시리얼은 serialList JSON) */
export interface Box {
  boxNo: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  status: BoxStatus;
  serialList: string | null;
  closeAt: string | null;
  palletNo: string | null;
  oqcStatus: string | null;
  /** 품목 마스터의 박스입수량 (없으면 제한 없음) */
  boxQty: number | null;
  createdAt: string;
}

interface CreatePackGridColumnsOptions {
  t: TFunction;
}

export function createPackGridColumns({
  t,
}: CreatePackGridColumnsOptions): ColumnDef<Box>[] {
  return [
    { accessorKey: "boxNo", header: t("shipping.pack.boxNo"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "qty", header: t("shipping.pack.packedQty"), size: 110, meta: { align: "center" as const, filterType: "number" as const },
      cell: ({ row }) => {
        const { qty, boxQty } = row.original;
        return <span className="font-medium">{(qty ?? 0).toLocaleString()}{boxQty ? <span className="text-text-muted"> / {boxQty.toLocaleString()}</span> : null}</span>;
      },
    },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="BOX_STATUS" align="center" />, size: 100, meta: { filterType: "multi" as const }, cell: ({ getValue }) => <BoxStatusBadge status={getValue() as BoxStatus} /> },
    { accessorKey: "closeAt", header: t("shipping.pack.closedAt"), size: 150, meta: { filterType: "date" as const }, cell: ({ getValue }) => (getValue() ? String(getValue()).replace("T", " ").slice(0, 16) : "-") },
  ];
}
