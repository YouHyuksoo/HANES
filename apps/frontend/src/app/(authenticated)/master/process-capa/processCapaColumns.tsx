"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

/** 공정 CAPA 마스터 아이템 */
export interface ProcessCapaItem {
  processCode: string;
  itemCode: string;
  stdTactTime: number;
  stdUph: number;
  workerCnt: number;
  boardCnt: number;
  equipCnt: number;
  setupTime: number;
  balanceEff: number;
  dailyCapa: number;
  useYn: string;
  remark?: string | null;
  process?: { processCode: string; processName: string } | null;
  part?: { itemCode: string; itemName: string } | null;
}

interface CreateProcessCapaGridColumnsOptions {
  t: TFunction;
}

export function createProcessCapaGridColumns({
  t,
}: CreateProcessCapaGridColumnsOptions): ColumnDef<ProcessCapaItem>[] {
  return [
    {
      accessorKey: "process.processName",
      header: t("processCapa.processCode"),
      size: 140,
      accessorFn: (row) => row.process?.processName ?? row.processCode,
    },
    { accessorKey: "itemCode", header: t("processCapa.itemCode"), size: 140 },
    {
      id: "itemName",
      header: t("common.partName"),
      size: 180,
      accessorFn: (row) => row.part?.itemName ?? "-",
    },
    {
      accessorKey: "stdTactTime",
      header: t("processCapa.stdTactTime"),
      size: 110,
      meta: { align: "right" as const },
    },
    {
      accessorKey: "stdUph",
      header: t("processCapa.stdUph"),
      size: 100,
      meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null | undefined;
        return v != null ? Number(v).toLocaleString() : "-";
      },
    },
    {
      accessorKey: "workerCnt",
      header: t("processCapa.workerCnt"),
      size: 90,
      meta: { align: "right" as const },
    },
    {
      accessorKey: "boardCnt",
      header: t("processCapa.boardCnt"),
      size: 100,
      meta: { align: "right" as const },
    },
    {
      accessorKey: "equipCnt",
      header: t("processCapa.equipCnt"),
      size: 90,
      meta: { align: "right" as const },
    },
    {
      accessorKey: "balanceEff",
      header: t("processCapa.balanceEff"),
      size: 110,
      meta: { align: "right" as const },
      cell: ({ getValue }) => `${getValue()}%`,
    },
    {
      accessorKey: "dailyCapa",
      header: t("processCapa.dailyCapa"),
      size: 100,
      meta: { align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold text-primary">
          {Number(getValue()).toLocaleString()}
        </span>
      ),
    },
    {
      accessorKey: "useYn",
      header: t("common.active"),
      size: 80,
      meta: { align: "center" as const },
      cell: ({ getValue }) => (
        <span
          className={
            getValue() === "Y"
              ? "text-green-600 dark:text-green-400"
              : "text-red-500 dark:text-red-400"
          }
        >
          {getValue() === "Y" ? "Y" : "N"}
        </span>
      ),
    },
  ];
}
