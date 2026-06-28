"use client";

import type { TFunction } from "i18next";
import { Eye } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import StatusBadge from "@/components/shared/StatusBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import { type ShelfLifeDetailRecord } from "./ShelfLifeDetailModal";

export interface ReinspectHistoryItem {
  inspectDate: string;
  seq?: number;
  matUid: string | null;
  itemCode: string;
  itemName?: string | null;
  result: string;
  retestRound: number | null;
  inspectorName?: string | null;
  destructSampleQty?: number | null;
  remark?: string | null;
  details?: string | null;
}

interface CreateShelfLifeHistoryGridColumnsOptions {
  t: TFunction;
  onViewDetail: (record: ShelfLifeDetailRecord) => void;
}

export function createShelfLifeHistoryGridColumns({
  t,
  onViewDetail,
}: CreateShelfLifeHistoryGridColumnsOptions): ColumnDef<ReinspectHistoryItem>[] {
  return [
    {
      id: "actions", header: t("common.actions", "작업"), size: 70, enableSorting: false,
      meta: { filterType: "none" as const, align: "center" as const },
      cell: ({ row }) => (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-surface hover:text-primary"
          title={t("material.shelfLife.viewDetail", "검사 상세보기")}
          onClick={(e) => { e.stopPropagation(); onViewDetail(row.original as ShelfLifeDetailRecord); }}
        >
          <Eye className="h-4 w-4" />
        </button>
      ),
    },
    {
      accessorKey: "inspectDate", header: t("common.date", "검사일"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleDateString() : "-";
      },
    },
    {
      accessorKey: "matUid", header: "LOT No.", size: 170,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "retestRound", header: t("material.shelfLife.retestRound", "재검회차"), size: 80,
      meta: { align: "center" as const, filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-medium">{(getValue() as number) ?? "-"}</span>,
    },
    {
      accessorKey: "result", header: () => <StatusHeaderHelp label={t("common.result", "결과")} codeType="INSPECT_RESULT" align="center" />, size: 90,
      meta: { align: "center" as const, filterType: "multi" as const },
      cell: ({ getValue }) => <StatusBadge codeType="INSPECT_RESULT" value={getValue() as string} />,
    },
    {
      accessorKey: "inspectorName", header: t("quality.iqcHistory.inspectorName", "검사자"), size: 110,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "remark", header: t("common.remark"), size: 200,
      meta: { filterType: "text" as const },
    },
  ];
}
