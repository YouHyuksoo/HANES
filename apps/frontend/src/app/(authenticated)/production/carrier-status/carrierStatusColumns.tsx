"use client";
/**
 * @file production/carrier-status/carrierStatusColumns.tsx
 * @description 대차현황 DataGrid 컬럼 — 상태/유형은 ComCodeBadge, 적재수는 "n/수용량".
 */
import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface CarrierStatusRow {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  status: "EMPTY" | "LOADING" | "IN_TRANSIT";
  kind: "SG" | "FG" | "MAT" | null;
  itemCode: string | null;
  itemName: string | null;
  orderNo: string | null;
  loadedCount: number;
  totalQty: number;
  slipNo: string | null;
  loadProcessCode: string | null;
  lastLoadedAt: string | null;
}

/** 서버가 내려주는 타임스탬프(ISO)를 "YYYY-MM-DD HH:mm:ss" 로 자른다 — @/utils/date 에는 datetime 포맷이 없다 */
function formatDateTime(value?: string | null): string {
  return value ? String(value).replace("T", " ").slice(0, 19) : "-";
}

export function createCarrierStatusColumns({ t }: { t: TFunction }): ColumnDef<CarrierStatusRow>[] {
  return [
    { accessorKey: "carrierNo", header: t("master.carrier.carrierNo"), size: 130, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono font-medium text-primary">{getValue() as string}</span> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="CARRIER_STATUS" align="center" />, size: 100,
      meta: { filterType: "multi" as const }, cell: ({ getValue }) => <ComCodeBadge groupCode="CARRIER_STATUS" code={getValue() as string} /> },
    { accessorKey: "carrierType", header: t("master.carrier.carrierType"), size: 100, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CARRIER_TYPE" code={getValue() as string} /> },
    { accessorKey: "kind", header: t("production.carrierStatus.kind"), size: 70, meta: { align: "center" as const },
      cell: ({ getValue }) => <span className="text-xs font-semibold">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 180 },
    { accessorKey: "orderNo", header: t("production.order.orderNo"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "loadProcessCode", header: t("production.carrierStatus.loadProcess"), size: 100 },
    { accessorKey: "loadedCount", header: t("production.carrierStatus.loadedCount"), size: 90, meta: { align: "right" as const },
      cell: ({ row }) => <span className="tabular-nums">{row.original.loadedCount}{row.original.capacity != null ? `/${row.original.capacity}` : ""}</span> },
    { accessorKey: "totalQty", header: t("production.carrierStatus.totalQty"), size: 90, meta: { align: "right" as const },
      cell: ({ getValue }) => <span className="tabular-nums">{(getValue() as number).toLocaleString()}</span> },
    { accessorKey: "slipNo", header: t("carrier.slipNo"), size: 140, cell: ({ getValue }) => <span className="font-mono">{(getValue() as string | null) ?? "-"}</span> },
    { accessorKey: "lastLoadedAt", header: t("production.carrierStatus.lastLoadedAt"), size: 150, cell: ({ getValue }) => formatDateTime(getValue() as string | null) },
  ];
}
