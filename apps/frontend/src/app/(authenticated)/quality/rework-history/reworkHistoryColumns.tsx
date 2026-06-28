"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 재작업 지시 레코드 타입 */
export interface ReworkOrder {
  reworkNo: string;
  itemCode: string;
  itemName: string;
  reworkQty: number;
  passQty: number;
  failQty: number;
  status: string;
  defectType: string;
  lineCode: string;
  qcApproverCode: string;
  prodApproverCode: string;
  createdAt: string;
}

interface CreateReworkHistoryGridColumnsOptions {
  t: TFunction;
}

export function createReworkHistoryGridColumns({
  t,
}: CreateReworkHistoryGridColumnsOptions): ColumnDef<ReworkOrder>[] {
  return [
    {
      accessorKey: "reworkNo",
      header: t("quality.rework.reworkNo"),
      size: 170,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">
          {getValue() as string}
        </span>
      ),
    },
    {
      accessorKey: "itemCode",
      header: t("quality.rework.itemCode"),
      size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "itemName",
      header: t("quality.rework.itemName"),
      size: 160,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "reworkQty",
      header: t("quality.rework.reworkQty"),
      size: 100,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-right block">
          {((getValue() as number) ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "passQty",
      header: t("quality.rework.passQty"),
      size: 100,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-right block text-green-600 dark:text-green-400">
          {((getValue() as number) ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "failQty",
      header: t("quality.rework.failQty"),
      size: 100,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-right block text-red-600 dark:text-red-400">
          {((getValue() as number) ?? 0).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="REWORK_STATUS" align="center" />,
      size: 130,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="REWORK_STATUS" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "qcApproverCode",
      header: t("quality.rework.qcApprove"),
      size: 110,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "prodApproverCode",
      header: t("quality.rework.prodApprove"),
      size: 110,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "createdAt",
      header: t("common.createdAt"),
      size: 150,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return val ? new Date(val).toLocaleString() : "-";
      },
    },
  ];
}
