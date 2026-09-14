"use client";

import type { ReactNode } from "react";
import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export type InventoryState = "PACKED_WAITING" | "WAREHOUSE_RECEIVED";

export interface StockBox {
  boxNo: string;
  itemCode: string;
  itemName: string | null;
  qty: number;
  orderNo: string | null;
  latestAt: string | null;
  oldestAt: string | null;
  storageDays: number | null;
  longStoredYn: "Y" | "N";
  longStockDays: number;
  inventoryState: InventoryState;
  warehouseCode: string | null;
  receivedAt: string | null;
}

export interface StockSerial {
  seq: number;
  fgBarcode: string;
  itemCode: string;
  itemName: string | null;
  orderNo: string | null;
  equipCode: string | null;
  workerId: string | null;
  lineCode: string | null;
  status: string | null;
  inspectPassYn: string | null;
  issuedAt: string | null;
  storageDays: number | null;
  longStoredYn: "Y" | "N";
  inventoryState: InventoryState;
  warehouseCode: string | null;
  receivedAt: string | null;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
}

/** 보관경과일 셀 — 장기보관이면 텍스트/테두리로만 강조한다(배경색 사용 금지) */
function renderStorageDays(days: number | null, longStored: boolean, t: TFunction): ReactNode {
  if (days === null || days === undefined) return "-";
  const label = t("shipping.boxStock.storageDaysValue", { count: days, defaultValue: "{{count}}일" });
  if (!longStored) return <span>{label}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
      {label}
      <span className="rounded border border-red-600 px-1 text-[10px] leading-4 dark:border-red-400">
        {t("shipping.boxStock.longStored", "장기보관")}
      </span>
    </span>
  );
}

interface CreateBoxStockGridColumnsOptions {
  t: TFunction;
  renderInventoryState: (state: InventoryState) => ReactNode;
}

export function createBoxStockGridColumns({
  t,
  renderInventoryState,
}: CreateBoxStockGridColumnsOptions): ColumnDef<StockBox>[] {
  return [
    { accessorKey: "boxNo", header: t("shipping.pack.boxNo"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 170, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "qty",
      header: t("shipping.boxStock.boxQty"),
      size: 90,
      meta: { align: "right" as const, filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-medium">{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "inventoryState",
      header: t("shipping.boxStock.inventoryState"),
      size: 125,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => renderInventoryState(getValue() as InventoryState),
    },
    { accessorKey: "warehouseCode", header: t("shipping.boxStock.warehouseCode"), size: 105, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "orderNo", header: t("shipping.boxStock.orderNo"), size: 130, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "latestAt", header: t("shipping.boxStock.issuedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
    { accessorKey: "receivedAt", header: t("shipping.boxStock.receivedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
    {
      accessorKey: "storageDays",
      header: t("shipping.boxStock.storageDays"),
      size: 120,
      meta: { align: "right" as const, filterType: "number" as const },
      cell: ({ row }) => renderStorageDays(row.original.storageDays, row.original.longStoredYn === "Y", t),
    },
  ];
}

export function createBoxStockSerialGridColumns({
  t,
  renderInventoryState,
}: CreateBoxStockGridColumnsOptions): ColumnDef<StockSerial>[] {
  return [
    { accessorKey: "seq", header: "No", size: 55, meta: { align: "center" as const, filterType: "number" as const } },
    { accessorKey: "fgBarcode", header: t("common.prdUid"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => (
      <span className="font-mono text-text">{getValue() as string}</span>
    ) },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 110, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 150, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "orderNo", header: t("shipping.boxStock.orderNo"), size: 130, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "status", header: t("common.status"), size: 95, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "inventoryState",
      header: t("shipping.boxStock.inventoryState"),
      size: 125,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => renderInventoryState(getValue() as InventoryState),
    },
    { accessorKey: "warehouseCode", header: t("shipping.boxStock.warehouseCode"), size: 105, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "inspectPassYn", header: t("shipping.boxStock.inspectPassYn"), size: 80, meta: { align: "center" as const, filterType: "multi" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "issuedAt", header: t("shipping.boxStock.issuedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
    { accessorKey: "receivedAt", header: t("shipping.boxStock.receivedAt"), size: 130, meta: { filterType: "date" as const }, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
    {
      accessorKey: "storageDays",
      header: t("shipping.boxStock.storageDays"),
      size: 120,
      meta: { align: "right" as const, filterType: "number" as const },
      cell: ({ row }) => renderStorageDays(row.original.storageDays, row.original.longStoredYn === "Y", t),
    },
  ];
}
