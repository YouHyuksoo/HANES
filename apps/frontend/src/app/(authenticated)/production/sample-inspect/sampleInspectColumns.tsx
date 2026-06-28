"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";

export interface SampleInspectRow {
  id: string;
  orderNo: string;
  itemCode: string;
  itemName: string;
  inspectDate: string;
  inspectorName: string;
  inspectType: string;
  sampleNo: number;
  measuredValue: string;
  specUpper: string;
  specLower: string;
  passYn: string;
  remark: string;
}

interface CreateSampleInspectGridColumnsOptions {
  t: TFunction;
}

export function createSampleInspectGridColumns({
  t,
}: CreateSampleInspectGridColumnsOptions): ColumnDef<SampleInspectRow>[] {
  return [
    {
      accessorKey: "inspectDate", header: t("production.sampleInspect.inspectDate"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "orderNo", header: t("production.sampleInspect.orderNo"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{getValue() as string}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 140,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "inspectType", header: t("production.sampleInspect.inspectType"), size: 90,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "sampleNo", header: t("production.sampleInspect.sampleNo"), size: 60,
      meta: { filterType: "number" as const, align: "center" as const },
      cell: ({ getValue }) => <span className="font-mono">{getValue() as number}</span>,
    },
    {
      accessorKey: "measuredValue", header: t("production.sampleInspect.measuredValue"), size: 90,
      meta: { filterType: "text" as const, align: "right" as const },
      cell: ({ getValue }) => <span className="font-mono">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "specLower", header: t("production.sampleInspect.specLower"), size: 70,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span className="text-text-muted">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "specUpper", header: t("production.sampleInspect.specUpper"), size: 70,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span className="text-text-muted">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "passYn", header: t("production.sampleInspect.judgment"), size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="JUDGE_YN" code={getValue() as string} />,
    },
    {
      accessorKey: "inspectorName", header: t("production.sampleInspect.inspector"), size: 80,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "remark", header: t("production.sampleInspect.remark"), size: 120,
      meta: { filterType: "text" as const },
    },
  ];
}
