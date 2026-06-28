"use client";

import type { TFunction } from "i18next";
import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface MatLotItem {
  id: string;
  matUid: string;
  itemCode?: string;
  itemName?: string;
  initQty: number;
  qty: number;
  /** GET /material/lots는 현재고를 currentQty로 반환한다(qty 미포함). fetch 경계에서 qty로 정규화한다. */
  currentQty?: number;
  unit?: string;
  vendor?: string;
  vendorName?: string | null;
  recvDate?: string;
  iqcStatus: string;
  status: string;
}

interface CreateLotGridColumnsOptions {
  t: TFunction;
  onViewDetail: (lot: MatLotItem) => void;
}

export function createLotGridColumns({
  t,
  onViewDetail,
}: CreateLotGridColumnsOptions): ColumnDef<MatLotItem>[] {
  return [
    {
      id: "actions", header: "", size: 50, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button className="p-1 hover:bg-surface rounded" title={t("common.detail")}
          onClick={() => { onViewDetail(row.original); }}>
          <Eye className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    {
      accessorKey: "matUid", header: t("material.lot.columns.matUid"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "vendor", header: t("material.lot.columns.vendor"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span>{row.original.vendorName || row.original.vendor || "-"}</span>,
    },
    {
      accessorKey: "recvDate", header: t("material.lot.columns.recvDate"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : "-";
      },
    },
    {
      accessorKey: "initQty", header: t("material.lot.columns.initQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span>{(row.original.initQty ?? 0).toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "qty", header: t("material.lot.columns.currentQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className={(row.original.qty ?? 0) <= 0 ? "text-text-muted" : "font-semibold"}>
          {(row.original.qty ?? 0).toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "iqcStatus", header: () => <StatusHeaderHelp label="IQC" codeType="IQC_STATUS" align="center" />, size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="IQC_STATUS" value={getValue() as string} />,
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="MAT_LOT_STATUS" align="center" />, size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="MAT_LOT_STATUS" value={getValue() as string} />,
    },
  ];
}
