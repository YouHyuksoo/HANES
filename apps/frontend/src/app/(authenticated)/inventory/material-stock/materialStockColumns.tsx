"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import type { StockItem, GroupItem } from "./page";

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

interface CreateMaterialStockGroupGridColumnsOptions {
  t: TFunction;
  stockLevelLabels: { shortage: string; caution: string; normal: string };
}

/** 시리얼별 상세 컬럼 */
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
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      accessorKey: "itemName",
      header: t("material.stock.columns.partName"),
      size: 140,
    },
    {
      accessorKey: "matUid",
      header: t("material.col.matUid"),
      size: 150,
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      accessorKey: "specialAcceptYn",
      header: t("material.concession.status"),
      size: 90,
      meta: { filterType: "multi" as const, align: "center" as const },
      cell: ({ getValue }) => {
        const isAccepted = (getValue() as string) === "Y";
        return isAccepted ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border text-primary border-primary">
            <BadgeCheck className="w-3.5 h-3.5" />
            {t("material.concession.accepted")}
          </span>
        ) : (
          <span className="text-text-muted">-</span>
        );
      },
    },
    {
      accessorKey: "warehouseName",
      header: t("material.stock.columns.warehouse"),
      size: 120,
      cell: ({ row }) => (
        <span>{row.original.warehouseName || row.original.warehouseCode}</span>
      ),
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
      cell: ({ row }) => {
        const d = row.original.manufactureDate;
        return d ? String(d).slice(0, 10) : "-";
      },
      meta: { filterType: "date" as const },
    },
    {
      id: "elapsedDays",
      header: t("material.stock.columns.elapsedDays"),
      size: 80,
      cell: ({ row }) => {
        const days = row.original.elapsedDays;
        if (days == null) return "-";
        return <span>{days}{t("material.stock.columns.dayUnit")}</span>;
      },
      meta: { align: "right" as const },
    },
    {
      id: "remainingDays",
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
      meta: { align: "right" as const },
    },
    {
      id: "shelfLifeStatus",
      header: t("material.stock.columns.shelfLifeStatus"),
      size: 80,
      cell: ({ row }) => (
        <ShelfLifeBadge
          remainingDays={row.original.remainingDays}
          labels={shelfLifeLabels}
        />
      ),
    },
  ];
}

/** 품목별 그룹 합계 컬럼 */
export function createMaterialStockGroupGridColumns({
  t,
  stockLevelLabels,
}: CreateMaterialStockGroupGridColumnsOptions): ColumnDef<GroupItem>[] {
  return [
    {
      accessorKey: "itemCode",
      header: t("material.stock.columns.partCode"),
      size: 130,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      accessorKey: "itemName",
      header: t("material.stock.columns.partName"),
      size: 200,
    },
    {
      accessorKey: "totalQty",
      header: t("material.stock.groupColumns.totalQty"),
      size: 110,
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.totalQty.toLocaleString()} {row.original.unit || ""}
        </span>
      ),
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "safetyStock",
      header: t("material.stock.columns.safetyStock"),
      size: 100,
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
      size: 90,
      cell: ({ row }) => (
        <StockLevelBadge
          quantity={row.original.totalQty}
          safetyStock={row.original.safetyStock}
          labels={stockLevelLabels}
        />
      ),
    },
    {
      accessorKey: "serialCount",
      header: t("material.stock.groupColumns.serialCount"),
      size: 100,
      cell: ({ getValue }) => (
        <span>{(getValue() as number).toLocaleString()}</span>
      ),
      meta: { filterType: "number" as const, align: "right" as const },
    },
    {
      accessorKey: "warehouseCount",
      header: t("material.stock.groupColumns.warehouseCount"),
      size: 100,
      cell: ({ getValue }) => (
        <span>{(getValue() as number).toLocaleString()}</span>
      ),
      meta: { filterType: "number" as const, align: "right" as const },
    },
  ];
}
