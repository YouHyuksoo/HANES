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
  inventoryState: InventoryState;
  warehouseCode: string | null;
  receivedAt: string | null;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  return String(value).replace("T", " ").slice(0, 16);
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
  ];
}
