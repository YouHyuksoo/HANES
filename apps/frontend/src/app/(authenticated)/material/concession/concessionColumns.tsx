"use client";

import type { TFunction } from "i18next";
import { BadgeCheck, ShieldCheck, ShieldX, AlertTriangle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui";

export interface ConcessionTarget {
  arrivalNo: string;
  itemCode: string;
  itemName: string | null;
  unit: string | null;
  vendor: string;
  totalQty: number;
  serialCount: number;
  specialAcceptCount: number;
  specialAcceptYn: string;
  specialAcceptWorkerCode?: string | null;
  specialAcceptWorkerName?: string | null;
}

const formatQty = (value?: number | null) => (typeof value === "number" ? value.toLocaleString() : "0");

export interface CreateConcessionGridColumnsOptions {
  t: TFunction;
  openModal: (row: ConcessionTarget, type: "apply" | "cancel") => void;
}

export function createConcessionGridColumns({
  t,
  openModal,
}: CreateConcessionGridColumnsOptions): ColumnDef<ConcessionTarget>[] {
  return [
    {
      id: "actions", header: t("material.concession.action"), size: 110,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => {
        const isAccepted = row.original.specialAcceptYn === "Y";
        return isAccepted ? (
          <Button size="sm" variant="secondary" onClick={() => openModal(row.original, "cancel")}>
            <ShieldX className="w-4 h-4 mr-1" />{t("material.concession.cancel")}
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={() => openModal(row.original, "apply")}>
            <ShieldCheck className="w-4 h-4 mr-1" />{t("material.concession.apply")}
          </Button>
        );
      },
    },
    {
      accessorKey: "arrivalNo", header: t("material.col.arrivalNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemCode", header: t("common.partCode"), size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "itemName", header: t("common.partName"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span>{(getValue() as string) || "-"}</span>,
    },
    {
      accessorKey: "vendor", header: t("material.col.supplier"), size: 110,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "serialCount", header: t("material.iqc.serialCount", "시리얼수"), size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => <span className="font-medium">{formatQty(row.original.serialCount)}</span>,
    },
    {
      accessorKey: "totalQty", header: t("material.iqc.totalQty", "총수량"), size: 110,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ row }) => (
        <span className="font-medium">{formatQty(row.original.totalQty)} {row.original.unit || ""}</span>
      ),
    },
    {
      accessorKey: "specialAcceptYn", header: t("material.concession.status"), size: 100,
      meta: { filterType: "multi" as const, align: "center" as const },
      cell: ({ getValue }) => {
        const isAccepted = (getValue() as string) === "Y";
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
            isAccepted
              ? "text-primary border-primary"
              : "text-text-muted border-border"
          }`}>
            {isAccepted ? <BadgeCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {isAccepted ? t("material.concession.accepted") : t("material.concession.notAccepted")}
          </span>
        );
      },
    },
    {
      id: "specialAcceptWorker",
      header: t("material.concession.specialAcceptWorker", "특채처리자"),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ row }) => (
        <span>{row.original.specialAcceptWorkerName || row.original.specialAcceptWorkerCode || "-"}</span>
      ),
    },
  ];
}
