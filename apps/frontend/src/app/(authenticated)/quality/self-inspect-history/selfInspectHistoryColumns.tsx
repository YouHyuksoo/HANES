"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

export interface HistoryRecord {
  id: string;
  orderNo: string;
  processCode: string | null;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  measureValue: number | null;
  remark: string | null;
  sampleNo: number;
  createdAt: string;
}

export interface DetailRecord {
  id: string;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  measureValue: number | null;
  remark: string | null;
  sampleNo: number;
  inspectedAt: string | null;
}

export interface CreateSelfInspectHistoryGridColumnsOptions {
  t: TFunction;
}

export function createSelfInspectHistoryGridColumns({
  t,
}: CreateSelfInspectHistoryGridColumnsOptions): ColumnDef<HistoryRecord, unknown>[] {
  return [
    { accessorKey: "orderNo", header: t("selfInspectHistory.orderNo", "작업지시"), size: 140 },
    { accessorKey: "processCode", header: t("selfInspectHistory.processCode", "공정"), size: 90 },
    { accessorKey: "itemName", header: t("selfInspectHistory.itemName", "항목명"), size: 160 },
    {
      accessorKey: "timing",
      header: t("selfInspectHistory.timing", "시점"),
      size: 60,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST"
          ? t("selfInspectHistory.timingFirst", "초물")
          : v === "MID"
            ? t("selfInspectHistory.timingMid", "중물")
            : t("selfInspectHistory.timingLast", "종물");
      },
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("selfInspectHistory.status", "결과")} codeType="QUALITY_JUDGMENT" align="center" />,
      size: 70,
      cell: ({ getValue }) => <StatusBadge codeType="QUALITY_JUDGMENT" value={getValue<string>()} />,
    },
    {
      accessorKey: "createdAt",
      header: t("selfInspectHistory.createdAt", "등록일시"),
      size: 130,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString() : "-";
      },
    },
  ];
}

export interface CreateSelfInspectHistoryDetailGridColumnsOptions {
  t: TFunction;
}

export function createSelfInspectHistoryDetailGridColumns({
  t,
}: CreateSelfInspectHistoryDetailGridColumnsOptions): ColumnDef<DetailRecord, unknown>[] {
  return [
    { accessorKey: "itemName", header: t("selfInspectHistory.itemName", "항목명"), size: 160 },
    {
      accessorKey: "timing",
      header: t("selfInspectHistory.timing", "시점"),
      size: 55,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST"
          ? t("selfInspectHistory.timingFirst", "초물")
          : v === "MID"
            ? t("selfInspectHistory.timingMid", "중물")
            : t("selfInspectHistory.timingLast", "종물");
      },
    },
    { accessorKey: "sampleNo", header: t("selfInspectHistory.sampleNo", "시료번호"), size: 65 },
    {
      accessorKey: "measureValue",
      header: t("selfInspectHistory.measureValue", "측정값"),
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v != null ? v : "-";
      },
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("selfInspectHistory.status", "결과")} codeType="QUALITY_JUDGMENT" align="center" />,
      size: 70,
      cell: ({ getValue }) => <StatusBadge codeType="QUALITY_JUDGMENT" value={getValue<string>()} />,
    },
    { accessorKey: "remark", header: t("selfInspectHistory.remark", "비고"), size: 150 },
  ];
}
