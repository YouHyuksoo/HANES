"use client";

import type { TFunction } from "i18next";
import { Scissors } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";

export interface SplittableLot {
  matUid: string;
  itemCode?: string;
  itemName?: string;
  qty: number;
  unit?: string;
  vendor?: string;
  vendorName?: string | null;
  mfgPartnerCode?: string | null;
  status: string;
}

interface CreateLotSplitGridColumnsOptions {
  t: TFunction;
  onSplit: (lot: SplittableLot) => void;
}

export function createLotSplitGridColumns({
  t,
  onSplit,
}: CreateLotSplitGridColumnsOptions): ColumnDef<SplittableLot>[] {
  return [
    {
      id: "actions", header: "", size: 90, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" onClick={() => onSplit(row.original)}>
          <Scissors className="w-4 h-4 mr-1" />{t("material.lotSplit.split")}
        </Button>
      ),
    },
    {
      accessorKey: "matUid", header: t("material.col.matUid"), size: 160,
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
      accessorKey: "qty", header: t("material.lotSplit.currentQty"), size: 120,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span className="font-semibold">{row.original.qty.toLocaleString()} {row.original.unit || ""}</span>,
    },
    {
      accessorKey: "vendor", header: t("material.lotSplit.vendor"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ row }) => <span>{row.original.vendorName || row.original.vendor || "-"}</span>,
    },
  ];
}
