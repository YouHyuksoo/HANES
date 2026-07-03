"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusBadge from "@/components/shared/StatusBadge";
import type { ProdOrderResultRow } from "./types";

function numberCell(value: number | null | undefined, className = "") {
  return <span className={className}>{(value ?? 0).toLocaleString()}</span>;
}

function rateCell(value: number | null | undefined, goodHigh = true) {
  const n = value ?? 0;
  const cls = goodHigh
    ? n >= 100 ? "text-green-600 dark:text-green-400" : n >= 80 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"
    : n <= 2 ? "text-green-600 dark:text-green-400" : n <= 5 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400";
  return <span className={`font-medium ${cls}`}>{n.toLocaleString()}%</span>;
}

export function createOrderResultGridColumns(t: TFunction): ColumnDef<ProdOrderResultRow>[] {
  return [
    {
      accessorKey: "orderNo",
      header: t("production.orderResult.orderNo"),
      size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: "status",
      header: t("production.orderResult.status"),
      size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="JOB_ORDER_STATUS" value={getValue() as string} />,
    },
    {
      accessorKey: "planDate",
      header: t("production.orderResult.planDate"),
      size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => getValue<string>() || "-",
    },
    {
      accessorKey: "itemCode",
      header: t("common.partCode"),
      size: 130,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue<string>()}</span>,
    },
    {
      accessorKey: "itemName",
      header: t("common.partName"),
      size: 170,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue<string>() || "-",
    },
    {
      accessorKey: "lineCode",
      header: t("production.orderResult.line"),
      size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue<string>() || "-",
    },
    {
      accessorKey: "processCode",
      header: t("production.orderResult.process"),
      size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue<string>() || "-",
    },
    {
      accessorKey: "orderKind",
      header: t("production.orderResult.orderKind"),
      size: 95,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => getValue<string>() || "-",
    },
    {
      accessorKey: "planQty",
      header: t("production.orderResult.planQty"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => numberCell(getValue<number>()),
    },
    {
      accessorKey: "totalGoodQty",
      header: t("production.orderResult.goodQty"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => numberCell(getValue<number>(), "text-green-600 dark:text-green-400 font-medium"),
    },
    {
      accessorKey: "totalDefectQty",
      header: t("production.orderResult.defectQty"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue<number>() ?? 0;
        return numberCell(v, v > 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-text-muted");
      },
    },
    {
      accessorKey: "totalQty",
      header: t("production.orderResult.totalQty"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => numberCell(getValue<number>(), "font-medium"),
    },
    {
      accessorKey: "remainingQty",
      header: t("production.orderResult.remainingQty"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => numberCell(getValue<number>(), "text-text-muted"),
    },
    {
      accessorKey: "achievementRate",
      header: t("production.orderResult.achievementRate"),
      size: 95,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => rateCell(getValue<number>(), true),
    },
    {
      accessorKey: "defectRate",
      header: t("production.orderResult.defectRate"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => rateCell(getValue<number>(), false),
    },
    {
      accessorKey: "resultCount",
      header: t("production.orderResult.resultCount"),
      size: 80,
      meta: { filterType: "number" as const, align: "center" as const },
      cell: ({ getValue }) => numberCell(getValue<number>(), "text-text-muted"),
    },
    {
      accessorKey: "lastResultAt",
      header: t("production.orderResult.lastResultAt"),
      size: 105,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => getValue<string>() || "-",
    },
  ];
}
