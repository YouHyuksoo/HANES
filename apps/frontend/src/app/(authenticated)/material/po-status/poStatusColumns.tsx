"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import type { ComCodeItem } from "@/hooks/useComCode";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface PoStatusItemRaw {
  id: number;
  poNo: string;
  itemCode: string;
  itemName: string;
  spec: string | null;
  unit: string | null;
  lineNo: number | null;
  relNo: number | null;
  orderQty: number;
  receivedQty: number;
  receiveRate: number;
}

export interface PoStatusRaw {
  poNo: string;
  partnerName: string;
  orderDate: string;
  dueDate: string;
  status: string;
  totalOrderQty: number;
  totalReceivedQty: number;
  receiveRate: number;
  items: PoStatusItemRaw[];
}

/** Date → 'YYYY-MM-DD' (로컬 기준, UTC 변환으로 인한 하루 밀림 방지) */
const toYmd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const RECEIVED_STATUS_CLASS = "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";

export interface CreatePoStatusGridColumnsOptions {
  t: TFunction;
  poStatusMap: Record<string, ComCodeItem>;
}

/** 마스터 그리드 컬럼 */
export function createPoStatusGridColumns({
  t,
  poStatusMap,
}: CreatePoStatusGridColumnsOptions): ColumnDef<PoStatusRaw>[] {
  return [
    {
      accessorKey: "poNo", header: "PO No.", size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "partnerName", header: t("material.po.partnerName"), size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "orderDate", header: t("material.po.orderDate"), size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        if (!v) return "-";
        if (!v.includes("T")) return v.slice(0, 10);
        const d = new Date(v);
        return isNaN(d.getTime()) ? v : toYmd(d);
      },
    },
    {
      accessorKey: "receiveRate", header: t("material.poStatus.receiveRate"), size: 130,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        const rateClass = rate >= 100 ? "bg-green-500" : rate > 0 ? "bg-yellow-500" : "bg-gray-400";
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${rateClass}`}
                style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="PO_STATUS" align="center" />, size: 100,
      meta: { filterType: "multi" as const },
      cell: ({ getValue, row }) => {
        const s = getValue() as string;
        const isReceived = s === "RECEIVED" || row.original.receiveRate >= 100;
        const statusClass = isReceived ? RECEIVED_STATUS_CLASS : poStatusMap[s]?.attr1 || "";
        const statusLabel = isReceived ? poStatusMap.RECEIVED?.codeName || t("material.poStatus.stats.received", "입고완료") : poStatusMap[s]?.codeName || s;
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusClass}`}>
            {statusLabel}
          </span>
        );
      },
    },
  ];
}

export interface CreatePoStatusDetailGridColumnsOptions {
  t: TFunction;
}

/** 디테일 그리드 컬럼 (품목별 입고현황) */
export function createPoStatusDetailGridColumns({
  t,
}: CreatePoStatusDetailGridColumnsOptions): ColumnDef<PoStatusItemRaw>[] {
  return [
    {
      accessorKey: "lineNo", header: t("material.poStatus.lineNo", "LINE NO"), size: 80,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="font-mono text-sm">{v ?? "-"}</span>;
      },
    },
    {
      accessorKey: "itemCode", header: t("material.poStatus.itemCode"), size: 100,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "itemName", header: t("material.poStatus.itemName"), size: 180,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "spec", header: t("material.poStatus.spec"), size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "unit", header: t("material.poStatus.unit"), size: 60,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "relNo", header: t("material.poStatus.relNo"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="font-mono text-sm">{v ?? "-"}</span>;
      },
    },
    {
      accessorKey: "orderQty", header: t("material.poStatus.orderQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-semibold">{((getValue() as number) ?? 0).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "receivedQty", header: t("material.poStatus.receivedQty"), size: 100,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => <span>{((getValue() as number) ?? 0).toLocaleString()}</span>,
    },
    {
      accessorKey: "receiveRate", header: t("material.poStatus.receiveRate"), size: 130,
      meta: { filterType: "none" as const },
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className={`h-2 rounded-full ${rate >= 100 ? "bg-green-500" : rate > 0 ? "bg-yellow-500" : "bg-gray-400"}`}
                style={{ width: `${Math.min(rate, 100)}%` }} />
            </div>
            <span className="text-xs font-medium w-10 text-right">{rate}%</span>
          </div>
        );
      },
    },
  ];
}
