"use client";

import type { TFunction } from "i18next";
import { Plus } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";

export interface MergeableLot {
  matUid: string;
  itemCode: string;
  itemName?: string;
  unit?: string;
  qty: number;
  status: string;
  origin?: string | null;
  arrivalNo?: string | null;
  expireDate?: string;
  vendor?: string;
  vendorName?: string | null;
  mfgPartnerCode?: string | null;
}

interface CreateLotMergeGridColumnsOptions {
  t: TFunction;
  scanned: MergeableLot[];
  addByBarcode: (raw: string) => void;
}

export function createLotMergeGridColumns({
  t,
  scanned,
  addByBarcode,
}: CreateLotMergeGridColumnsOptions): ColumnDef<MergeableLot>[] {
  return [
    {
      id: "add", header: "", size: 60, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <Button size="sm" variant="secondary" disabled={scanned.some((s) => s.matUid === row.original.matUid)}
          onClick={() => addByBarcode(row.original.matUid)}>
          <Plus className="w-4 h-4" />
        </Button>
      ),
    },
    { accessorKey: "matUid", header: t("material.lotMerge.matUid"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("common.quantity"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue, row }) => (
        <span className="font-semibold">{((getValue() as number) ?? 0).toLocaleString()} {row.original.unit || "EA"}</span>
      ),
    },
    { accessorKey: "arrivalNo", header: t("material.col.arrivalNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-xs text-text-muted">{(getValue() as string) || "-"}</span>,
    },
    { accessorKey: "vendor", header: t("material.lotMerge.vendor"), size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.vendorName || row.original.vendor || "-",
    },
  ];
}
