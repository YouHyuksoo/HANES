"use client";

import type { TFunction } from "i18next";
import { ColumnDef } from "@tanstack/react-table";

export interface DelegateItem {
  id: string;
  orderNo: string;
  processCode: string | null;
  itemName: string;
  timing: string;
  inspectMethod: string;
  status: string;
  remark: string | null;
  measureValue: number | null;
  sampleNo: number;
  createdAt: string;
  // 검사항목 마스터(SELF_INSPECT_ITEMS) JOIN — 공정생품검사 설정 기준
  itemType: string | null;
  unit: string | null;
  standard: string | null;
  lslValue: number | null;
  uslValue: number | null;
}

interface CreateRequestInspectGridColumnsOptions {
  t: TFunction;
}

export function createRequestInspectGridColumns({
  t,
}: CreateRequestInspectGridColumnsOptions): ColumnDef<DelegateItem, unknown>[] {
  return [
    { accessorKey: "orderNo", header: t("requestInspect.orderNo", "작업지시"), size: 140 },
    { accessorKey: "processCode", header: t("requestInspect.processCode", "공정"), size: 90 },
    { accessorKey: "itemName", header: t("requestInspect.itemName", "항목명"), size: 180 },
    {
      accessorKey: "timing",
      header: t("requestInspect.timing", "시점"),
      size: 60,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v === "FIRST"
          ? t("requestInspect.timingFirst", "초물")
          : v === "MID"
            ? t("requestInspect.timingMid", "중물")
            : t("requestInspect.timingLast", "종물");
      },
    },
    {
      accessorKey: "createdAt",
      header: t("requestInspect.requestedAt", "요청일시"),
      size: 140,
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return v ? new Date(v).toLocaleString() : "-";
      },
    },
  ];
}
