"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface ArrivalStockItem {
  id: string;
  arrivalNo: string;
  invoiceNo: string;
  poNo: string | null;
  vendorName: string;
  itemCode: string;
  itemName: string;
  unit: string;
  matUid: string;
  arrivalQty: number;
  currentStock: number;
  warehouseName: string;
  arrivalType: string;
  arrivalDate: string;
  manufactureDate: string | null;
  expireDate: string | null;
}

const arrivalTypeColors: Record<string, string> = {
  PO: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  MANUAL: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
};

const formatDate = (val: string | null) => {
  if (!val) return "-";
  return new Date(val).toLocaleDateString();
};

interface CreateArrivalStockGridColumnsOptions {
  t: TFunction;
}

export function createArrivalStockGridColumns({
  t,
}: CreateArrivalStockGridColumnsOptions): ColumnDef<ArrivalStockItem>[] {
  return [
      {
        accessorKey: "arrivalNo",
        header: t("material.arrivalStock.arrivalNo"),
        size: 180,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "invoiceNo",
        header: t("material.arrivalStock.invoiceNo"),
        size: 130,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "vendorName",
        header: t("material.arrivalStock.vendorName"),
        size: 120,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (getValue() as string) || "-",
      },
      {
        accessorKey: "itemCode",
        header: t("material.arrivalStock.partCode"),
        size: 130,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "itemName",
        header: t("material.arrivalStock.partName"),
        size: 150,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "matUid",
        header: t("material.arrivalStock.matUid"),
        size: 170,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-sm">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: "arrivalQty",
        header: t("material.arrivalStock.arrivalQty"),
        size: 100,
        meta: { filterType: "number" as const, align: "right" as const },
        cell: ({ getValue }) => (
          <span>{((getValue() as number) ?? 0).toLocaleString()}</span>
        ),
      },
      {
        accessorKey: "currentStock",
        header: t("material.arrivalStock.currentStock"),
        size: 100,
        meta: { filterType: "number" as const, align: "right" as const },
        cell: ({ getValue }) => {
          const v = getValue() as number;
          return (
            <span
              className={
                v === 0
                  ? "text-red-500 dark:text-red-400"
                  : "font-semibold text-green-600 dark:text-green-400"
              }
            >
              {v.toLocaleString()}
            </span>
          );
        },
      },
      {
        accessorKey: "unit",
        header: t("material.arrivalStock.unit"),
        size: 60,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "warehouseName",
        header: t("material.arrivalStock.warehouseName"),
        size: 100,
        meta: { filterType: "text" as const },
      },
      {
        accessorKey: "arrivalType",
        header: t("material.arrivalStock.arrivalType"),
        size: 90,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return (
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${arrivalTypeColors[v] || ""}`}
            >
              {v}
            </span>
          );
        },
      },
      {
        accessorKey: "arrivalDate",
        header: t("material.arrivalStock.arrivalDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => formatDate(getValue() as string),
      },
      {
        accessorKey: "manufactureDate",
        header: t("material.arrivalStock.manufactureDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
      {
        accessorKey: "expireDate",
        header: t("material.arrivalStock.expireDate"),
        size: 100,
        meta: { filterType: "date" as const },
        cell: ({ getValue }) => formatDate(getValue() as string | null),
      },
  ];
}
