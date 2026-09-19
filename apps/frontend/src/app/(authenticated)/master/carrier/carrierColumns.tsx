"use client";
/**
 * @file src/app/(authenticated)/master/carrier/carrierColumns.tsx
 * @description 대차 마스터 DataGrid 컬럼 팩토리. 유형은 ComCodeBadge(CARRIER_TYPE), 수용량 NULL은 "무제한" 표기.
 */
import type { TFunction } from "i18next";
import { Edit2, Printer, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

export interface CarrierRow {
  carrierNo: string;
  carrierType: string;
  carrierName: string | null;
  capacity: number | null;
  useYn: string;
  remark: string | null;
  updatedAt: string;
}

interface Options {
  t: TFunction;
  onEdit: (row: CarrierRow) => void;
  onDelete: (row: CarrierRow) => void;
  onPrintLabel: (row: CarrierRow) => void;
}

export function createCarrierGridColumns({ t, onEdit, onDelete, onPrintLabel }: Options): ColumnDef<CarrierRow>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 110, meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button type="button" onClick={() => onEdit(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.edit")}>
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button type="button" onClick={() => onPrintLabel(row.original)} className="p-1 hover:bg-surface rounded" title={t("master.carrier.qrLabelTitle")} data-testid="carrier-label-open">
            <Printer className="w-4 h-4 text-text-muted" />
          </button>
          <button type="button" onClick={() => onDelete(row.original)} className="p-1 hover:bg-surface rounded" title={t("common.delete")}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      accessorKey: "carrierNo", header: t("master.carrier.carrierNo"), size: 140, meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="font-mono font-medium text-primary">{getValue() as string}</span>,
    },
    {
      accessorKey: "carrierType",
      header: () => <StatusHeaderHelp label={t("master.carrier.carrierType")} codeType="CARRIER_TYPE" align="center" />,
      size: 110, meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="CARRIER_TYPE" code={getValue() as string} />,
    },
    { accessorKey: "carrierName", header: t("master.carrier.carrierName"), size: 180, meta: { filterType: "text" as const } },
    {
      accessorKey: "capacity", header: t("master.carrier.capacity"), size: 90, meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return <span className="tabular-nums">{v == null ? t("master.carrier.capacityUnlimited") : v.toLocaleString()}</span>;
      },
    },
    {
      accessorKey: "useYn", header: t("common.useYn"), size: 80, meta: { align: "center" as const },
      cell: ({ getValue }) => <span className={(getValue() as string) === "Y" ? "text-green-600 dark:text-green-400 font-semibold" : "text-text-muted"}>{getValue() as string}</span>,
    },
    { accessorKey: "remark", header: t("common.remark"), size: 200 },
  ];
}
