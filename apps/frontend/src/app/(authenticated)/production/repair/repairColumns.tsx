"use client";

import type { TFunction } from "i18next";
import { Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";
import StatusBadge from "@/components/shared/StatusBadge";

/** 수리 목록 아이템 타입 */
export interface RepairItem {
  repairDate: string;
  seq: number;
  status: string;
  fgBarcode: string | null;
  itemCode: string;
  itemName: string | null;
  qty: number;
  prdUid: string | null;
  sourceProcess: string | null;
  returnProcess: string | null;
  repairResult: string | null;
  genuineType: string | null;
  defectType: string | null;
  defectCause: string | null;
  defectPosition: string | null;
  disposition: string | null;
  workerId: string | null;
  receivedAt: string | null;
  completedAt: string | null;
  remark: string | null;
  createdAt: string;
}

interface CreateRepairGridColumnsOptions {
  t: TFunction;
  onDeleteRepair: (repair: RepairItem) => void;
}

export function createRepairGridColumns({
  t,
  onDeleteRepair,
}: CreateRepairGridColumnsOptions): ColumnDef<RepairItem>[] {
  return [
    {
      accessorKey: "repairDate",
      header: t("production.repair.repairDate"),
      size: 100,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? v.substring(0, 10) : "-";
      },
    },
    { accessorKey: "seq", header: t("production.repair.seq"), size: 60, meta: { filterType: "none" as const } },
    {
      accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("production.repair.status")} codeType="REPAIR_STATUS" align="center" />,
      size: 90,
      meta: { filterType: "select" as const },
      cell: ({ getValue }) => <StatusBadge codeType="REPAIR_STATUS" value={getValue() as string} />,
    },
    { accessorKey: "fgBarcode", header: t("production.repair.fgBarcode"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "itemCode", header: t("production.repair.itemCode"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("production.repair.itemName"), size: 150, meta: { filterType: "text" as const } },
    {
      accessorKey: "qty", header: t("production.repair.qty"), size: 60,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return v != null ? v.toLocaleString() : "-";
      },
    },
    {
      accessorKey: "genuineType",
      header: t("production.repair.genuineType"),
      size: 80,
      meta: { filterType: "select" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <ComCodeBadge groupCode="DEFECT_GENUINE" code={v} /> : "-";
      },
    },
    {
      accessorKey: "defectType",
      header: t("production.repair.defectType"),
      size: 90,
      meta: { filterType: "select" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <ComCodeBadge groupCode="DEFECT_TYPE" code={v} /> : "-";
      },
    },
    {
      accessorKey: "repairResult",
      header: () => <StatusHeaderHelp label={t("production.repair.repairResult")} codeType="REPAIR_RESULT" align="center" />,
      size: 90,
      meta: { filterType: "select" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <ComCodeBadge groupCode="REPAIR_RESULT" code={v} /> : "-";
      },
    },
    {
      accessorKey: "disposition",
      header: t("production.repair.disposition"),
      size: 110,
      meta: { filterType: "select" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? <ComCodeBadge groupCode="REPAIR_DISPOSITION" code={v} /> : "-";
      },
    },
    {
      id: "actions",
      header: "",
      size: 50,
      cell: ({ row }) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteRepair(row.original);
          }}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      ),
    },
  ];
}
