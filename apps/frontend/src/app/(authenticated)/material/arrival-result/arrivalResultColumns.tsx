"use client";

import type { TFunction } from "i18next";
import { Ban } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import ComCodeBadge from "@/components/ui/ComCodeBadge";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface ArrivalResultRow {
  arrivalNo: string;
  seq: number;
  poNo: string | null;
  lineNo: number | null;
  relNo: number | null;
  arrivalDate: string | null;
  createdAt: string | null;
  itemCode: string;
  itemName: string | null;
  qty: number;
  serialCount: number;
  receivedCount: number;
  poType: string;
  status: string;
  iqcStatus: string | null;
  vendorCode: string | null;
  vendorName: string | null;
  mfgPartnerCode: string | null;
  mfgPartnerName: string | null;
  cancelable: boolean;
}

const fmtDate = (v: string | null) => (v ? String(v).slice(0, 10) : "-");

export interface CreateArrivalResultGridColumnsOptions {
  t: TFunction;
  onCancelArrival: (row: ArrivalResultRow) => void;
}

export function createArrivalResultGridColumns({
  t,
  onCancelArrival,
}: CreateArrivalResultGridColumnsOptions): ColumnDef<ArrivalResultRow>[] {
  return [
    {
      id: "cancel",
      header: "",
      size: 90,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const r = row.original;
        return (
          <button
            type="button"
            disabled={!r.cancelable}
            onClick={(e) => { e.stopPropagation(); if (r.cancelable) onCancelArrival(r); }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-white ${
              r.cancelable ? "bg-red-600 hover:bg-red-700" : "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
            }`}
          >
            <Ban className="w-3.5 h-3.5" />
            {t("material.arrivalResult.cancel", "입하취소")}
          </button>
        );
      },
    },
    {
      accessorKey: "arrivalNo",
      header: t("material.arrivalResult.col.arrivalNo", "입하번호"),
      size: 135,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-semibold text-slate-800 dark:text-slate-200">{getValue() as string}</span>,
    },
    { accessorKey: "poNo", header: t("material.arrival.col.poNo"), size: 115, meta: { filterType: "text" as const } },
    { accessorKey: "lineNo", header: "L/N", size: 50, meta: { filterType: "number" as const }, cell: ({ getValue }) => <div className="text-center">{(getValue() as number) ?? "-"}</div> },
    { accessorKey: "relNo", header: "R/N", size: 50, meta: { filterType: "number" as const }, cell: ({ getValue }) => { const v = getValue() as number | null; return <div className="text-center">{v != null ? `R${v}` : "-"}</div>; } },
    { accessorKey: "arrivalDate", header: t("material.arrivalResult.col.arrivalDate", "입하일"), size: 105, meta: { filterType: "date" as const }, cell: ({ getValue }) => <div className="text-center">{fmtDate(getValue() as string)}</div> },
    { accessorKey: "createdAt", header: t("material.arrivalResult.col.createdAt", "등록일자"), size: 110, meta: { filterType: "date" as const }, cell: ({ getValue }) => <div className="text-center">{fmtDate(getValue() as string)}</div> },
    {
      accessorKey: "vendorName",
      header: t("material.arrivalResult.supplier", "공급사"),
      size: 140,
      meta: { filterType: "text" as const },
      cell: ({ row }) => (
        <span className="text-slate-800 dark:text-slate-200" title={row.original.vendorCode ?? ""}>
          {row.original.vendorName ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "itemCode",
      header: t("common.partCode"),
      size: 110,
      meta: { filterType: "text" as const },
      cell: ({ row }) => (
        <span className="font-semibold text-slate-800 dark:text-slate-200" title={row.original.itemName ?? ""}>
          {row.original.itemCode}
        </span>
      ),
    },
    { accessorKey: "itemName", header: t("common.partName"), size: 150, meta: { filterType: "text" as const } },
    { accessorKey: "qty", header: t("material.arrivalResult.col.qty", "입하수량"), size: 90, meta: { filterType: "number" as const }, cell: ({ getValue }) => <div className="text-right">{((getValue() as number) ?? 0).toLocaleString()}</div> },
    { accessorKey: "serialCount", header: t("material.arrivalResult.col.serialCount", "시리얼"), size: 70, meta: { filterType: "number" as const }, cell: ({ getValue }) => <div className="text-center font-semibold">{((getValue() as number) ?? 0).toLocaleString()}</div> },
    {
      accessorKey: "poType",
      header: () => <StatusHeaderHelp label={t("material.arrivalResult.col.poType", "구분")} codeType="ARRIVAL_PO_TYPE" align="center" />,
      size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="ARRIVAL_PO_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="ARRIVAL_RESULT_STATUS" align="center" />,
      size: 95,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="ARRIVAL_RESULT_STATUS" code={getValue() as string} />,
    },
  ];
}
