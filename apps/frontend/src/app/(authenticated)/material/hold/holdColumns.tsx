"use client";

import type { Dispatch, SetStateAction } from "react";
import type { TFunction } from "i18next";
import { Lock, Unlock } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface HoldLot {
  matUid: string;
  itemCode: string;
  itemName: string;
  qty: number;
  unit: string;
  status: string;
  vendor: string;
  vendorName?: string | null;
  warehouseName?: string;
}

export const formatQty = (value?: number | null) => (typeof value === "number" ? value.toLocaleString() : "0");

interface CreateHoldGridColumnsOptions {
  t: TFunction;
  setSelectedLot: Dispatch<SetStateAction<HoldLot | null>>;
  setActionType: Dispatch<SetStateAction<"hold" | "release">>;
  setReason: Dispatch<SetStateAction<string>>;
  setIsModalOpen: Dispatch<SetStateAction<boolean>>;
}

export function createHoldGridColumns({
  t,
  setSelectedLot,
  setActionType,
  setReason,
  setIsModalOpen,
}: CreateHoldGridColumnsOptions): ColumnDef<HoldLot>[] {
  return [
    {
      id: "actions", header: "", size: 100, meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const isHold = row.original.status === "HOLD";
        return (
          <Button size="sm" className="!h-6 !px-2 !text-xs !gap-1 !rounded-md" variant={isHold ? "secondary" : "primary"} onClick={() => {
            setSelectedLot(row.original);
            setActionType(isHold ? "release" : "hold");
            setReason("");
            setIsModalOpen(true);
          }}>
            {isHold
              ? <><Unlock className="w-4 h-4 mr-1" />{t("material.hold.release")}</>
              : <><Lock className="w-4 h-4 mr-1" />{t("material.hold.hold")}</>}
          </Button>
        );
      },
    },
    {
      accessorKey: "matUid", header: t("common.matUid"), size: 160,
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
      accessorKey: "qty", header: t("material.hold.currentQty"), size: 120,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="font-semibold">{formatQty(row.original.qty)} {row.original.unit || ""}</span>
      ),
    },
    {
      accessorKey: "vendor", header: t("material.hold.vendor"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ row }) => row.original.vendorName || row.original.vendor || "-",
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="MAT_LOT_STATUS" align="center" />, size: 80, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="MAT_LOT_STATUS" value={getValue() as string} />,
    },
  ];
}
