"use client";

import type { TFunction } from "i18next";
import { Lock, Unlock } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface ProductHoldStock {
  id: string;
  warehouseCode: string;
  itemCode: string;
  itemName: string;
  itemType: string;
  qty: number;
  unit: string;
  status: string;
  holdReason: string | null;
  holdAt: string | null;
}

interface CreateProductHoldGridColumnsOptions {
  t: TFunction;
  setSelectedStock: (stock: ProductHoldStock) => void;
  setActionType: (type: "hold" | "release") => void;
  setReason: (reason: string) => void;
  setIsModalOpen: (open: boolean) => void;
}

export function createProductHoldGridColumns({
  t,
  setSelectedStock,
  setActionType,
  setReason,
  setIsModalOpen,
}: CreateProductHoldGridColumnsOptions): ColumnDef<ProductHoldStock>[] {
  return [
    {
      id: "actions", header: "", size: 100,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const isHold = row.original.status === "HOLD";
        return (
          <Button size="sm" variant={isHold ? "secondary" : "primary"} onClick={() => {
            setSelectedStock(row.original);
            setActionType(isHold ? "release" : "hold");
            setReason("");
            setIsModalOpen(true);
          }}>
            {isHold
              ? <><Unlock className="w-4 h-4 mr-1" />{t("productHold.release")}</>
              : <><Lock className="w-4 h-4 mr-1" />{t("productHold.hold")}</>}
          </Button>
        );
      },
    },
    {
      accessorKey: "itemCode", header: t("productHold.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("productHold.partName"), size: 160,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "itemType", header: t("productHold.partType"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="ITEM_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "warehouseCode", header: t("productHold.warehouseCode"), size: 100,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "qty", header: t("productHold.qty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="font-semibold">
          {row.original.qty?.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="PRODUCT_HOLD_STATUS" align="center" />,
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="PRODUCT_HOLD_STATUS" value={getValue() as string} />,
    },
    {
      accessorKey: "holdReason", header: t("productHold.holdReason"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-sm text-text-muted">{(getValue() as string) || "-"}</span>
      ),
    },
  ];
}
