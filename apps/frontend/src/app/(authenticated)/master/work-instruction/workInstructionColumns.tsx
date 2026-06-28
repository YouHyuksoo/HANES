"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { type WorkInstruction } from "./components/WorkInstructionFormPanel";

interface CreateWorkInstructionGridColumnsOptions {
  t: TFunction;
  onEditWorkInstruction: (workInstruction: WorkInstruction) => void;
  onDeleteWorkInstruction: (workInstruction: WorkInstruction) => void;
}

export function createWorkInstructionGridColumns({
  t,
  onEditWorkInstruction,
  onDeleteWorkInstruction,
}: CreateWorkInstructionGridColumnsOptions): ColumnDef<WorkInstruction>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 84,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEditWorkInstruction(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteWorkInstruction(row.original); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "itemCode", header: t("common.partCode"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "itemName", header: t("common.partName"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "processCode", header: t("master.workInstruction.processCode"), size: 90, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "title", header: t("master.workInstruction.docTitle"), size: 220, meta: { filterType: "text" as const } },
    {
      accessorKey: "revision", header: "Rev", size: 60,
      cell: ({ getValue }) => <span className="px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">{getValue() as string}</span>,
    },
    { accessorKey: "updatedAt", header: t("master.workInstruction.updatedAt"), size: 100 },
    {
      accessorKey: "useYn", header: t("master.workInstruction.use"), size: 60,
      cell: ({ getValue }) => <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />,
    },
  ];
}
