"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import type { ComCodeItem } from "@/hooks/useComCode";
import type { PurchaseOrder } from "./components/PoFormPanel";

export interface CreatePoGridColumnsOptions {
  t: TFunction;
  poStatusMap: Record<string, ComCodeItem>;
  onEditPo: (po: PurchaseOrder) => void;
  onDeletePo: (po: PurchaseOrder) => void;
}

export function createPoGridColumns({
  t,
  poStatusMap,
  onEditPo,
  onDeletePo,
}: CreatePoGridColumnsOptions): ColumnDef<PurchaseOrder>[] {
  return [
    {
      id: "actions", header: "", size: 70,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEditPo(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeletePo(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "poNo", header: t("material.po.poNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "partnerName", header: t("material.po.partnerName"), size: 130,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "orderDate", header: t("material.po.orderDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      accessorKey: "dueDate", header: t("material.po.dueDate"), size: 100,
      meta: { filterType: "date" as const },
    },
    {
      id: "itemCount", header: t("material.po.itemCount", "품목수"), size: 70,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <span className="font-semibold">{row.original.items?.length ?? 0}</span>
      ),
    },
    {
      accessorKey: "totalAmount", header: t("material.po.totalAmount"), size: 120,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold">
          {(getValue() as number | null)?.toLocaleString() ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="PO_STATUS" align="center" />, size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const s = getValue() as string;
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${poStatusMap[s]?.attr1 || ""}`}>
            {poStatusMap[s]?.codeName || s}
          </span>
        );
      },
    },
  ];
}
