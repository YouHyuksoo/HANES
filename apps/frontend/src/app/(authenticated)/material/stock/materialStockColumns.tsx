"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui";

/** API 응답 재고 인터페이스 */
export interface StockItem {
  id: string;
  warehouseCode: string;
  locationCode?: string | null;
  itemCode: string;
  matUid?: string | null;
  qty: number;
  reservedQty: number;
  availableQty: number;
  itemName?: string;
  vendor?: string | null;
  vendorName?: string | null;
  unit?: string;
  safetyStock?: number;
  expiryDays?: number;
  manufactureDate?: string | null;
  expireDate?: string | null;
  elapsedDays?: number | null;
  remainingDays?: number | null;
}

/** 유효기간 상태 배지 */
function ShelfLifeBadge({
  remainingDays,
  labels,
}: {
  remainingDays: number | null | undefined;
  labels: { expired: string; imminent: string; normal: string };
}) {
  if (remainingDays == null) return <span className="text-text-muted">-</span>;

  if (remainingDays <= 0) {
    return <Badge variant="error">{labels.expired}</Badge>;
  } else if (remainingDays <= 30) {
    return <Badge variant="warning">{labels.imminent}</Badge>;
  }
  return <Badge variant="success">{labels.normal}</Badge>;
}

/** 안전재고 대비 상태 표시 */
function StockLevelBadge({
  quantity,
  safetyStock,
  labels,
}: {
  quantity: number;
  safetyStock: number;
  labels: { shortage: string; caution: string; normal: string };
}) {
  if (!safetyStock || safetyStock <= 0) return null;
  const ratio = quantity / safetyStock;
  if (ratio < 1) {
    return <Badge variant="error">{labels.shortage}</Badge>;
  } else if (ratio < 1.5) {
    return <Badge variant="warning">{labels.caution}</Badge>;
  }
  return <Badge variant="success">{labels.normal}</Badge>;
}

interface CreateMaterialStockGridColumnsOptions {
  t: TFunction;
  stockLevelLabels: { shortage: string; caution: string; normal: string };
  shelfLifeLabels: { expired: string; imminent: string; normal: string };
}

export function createMaterialStockGridColumns({
  t,
  stockLevelLabels,
  shelfLifeLabels,
}: CreateMaterialStockGridColumnsOptions): ColumnDef<StockItem>[] {
  return [
      {
        accessorKey: "itemCode",
        header: t("material.stock.columns.partCode"),
        size: 110,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>
        ),
      },
      {
        accessorKey: "itemName",
        header: t("material.stock.columns.partName"),
        size: 140,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "vendorName",
        header: t("material.arrivalResult.supplier", "공급사"),
        size: 130,
        meta: { filterType: "text" as const },
        cell: ({ row }) => row.original.vendorName || "-",
      },
      {
        accessorKey: "matUid",
        header: t("material.col.matUid"),
        size: 150,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>
        ),
      },
      {
        accessorKey: "warehouseCode",
        header: t("material.stock.columns.warehouse"),
        size: 100,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "qty",
        header: t("material.stock.columns.quantity"),
        size: 90,
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.qty.toLocaleString()} {row.original.unit || ""}
          </span>
        ),
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        accessorKey: "safetyStock",
        header: t("material.stock.columns.safetyStock"),
        size: 90,
        cell: ({ getValue }) => {
          const val = getValue() as number;
          return val ? (
            <span className="text-text-muted">{val.toLocaleString()}</span>
          ) : (
            <span className="text-text-muted">-</span>
          );
        },
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        id: "stockLevel",
        header: t("material.stock.columns.status"),
        size: 80,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <StockLevelBadge
            quantity={row.original.qty}
            safetyStock={row.original.safetyStock || 0}
            labels={stockLevelLabels}
          />
        ),
      },
      {
        accessorKey: "manufactureDate",
        header: t("material.stock.columns.manufactureDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ row }) => {
          const d = row.original.manufactureDate;
          return d ? String(d).slice(0, 10) : "-";
        },
      },
      {
        accessorKey: "elapsedDays",
        header: t("material.stock.columns.elapsedDays"),
        size: 80,
        cell: ({ row }) => {
          const days = row.original.elapsedDays;
          if (days == null) return "-";
          return <span>{days}{t("material.stock.columns.dayUnit")}</span>;
        },
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        accessorKey: "remainingDays",
        header: t("material.stock.columns.remainingDays"),
        size: 100,
        cell: ({ row }) => {
          const days = row.original.remainingDays;
          if (days == null) return "-";
          const color =
            days <= 0
              ? "text-red-600 font-bold"
              : days <= 30
              ? "text-yellow-600 font-medium"
              : "text-green-600";
          return (
            <span className={color}>
              {days}{t("material.stock.columns.dayUnit")}
            </span>
          );
        },
        meta: { filterType: "number" as const, align: "right" as const },
      },
      {
        id: "shelfLifeStatus",
        header: t("material.stock.columns.shelfLifeStatus"),
        size: 80,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <ShelfLifeBadge
            remainingDays={row.original.remainingDays}
            labels={shelfLifeLabels}
          />
        ),
      },
    ];
}
