"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Protocol } from "./components/ProtocolFormPanel";

interface CreateProtocolGridColumnsOptions {
  t: TFunction;
  onEditProtocol: (protocol: Protocol) => void;
  onDeleteProtocol: (protocol: Protocol) => void;
}

export function createProtocolGridColumns({
  t,
  onEditProtocol,
  onDeleteProtocol,
}: CreateProtocolGridColumnsOptions): ColumnDef<Protocol>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={() => { onEditProtocol(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={e => { e.stopPropagation(); onDeleteProtocol(row.original); }}
            className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "protocolId", header: t("inspection.protocol.protocolId"), size: 130, meta: { filterType: "text" as const } },
    { accessorKey: "protocolName", header: t("inspection.protocol.protocolName"), size: 160, meta: { filterType: "text" as const } },
    { accessorKey: "commType", header: t("inspection.protocol.commType"), size: 90, meta: { filterType: "multi" as const } },
    { accessorKey: "delimiter", header: t("inspection.protocol.delimiter"), size: 70 },
    { accessorKey: "passValue", header: t("inspection.protocol.passValue"), size: 80 },
    { accessorKey: "failValue", header: t("inspection.protocol.failValue"), size: 80 },
    { accessorKey: "sampleData", header: t("inspection.protocol.sampleData"), size: 200, cell: ({ getValue }) => {
      const v = getValue() as string | null;
      return <span className="text-xs text-text-muted truncate">{v || "-"}</span>;
    }},
    {
      accessorKey: "useYn", header: t("common.useYn"), size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-1.5 py-0.5 text-xs rounded ${v === "Y"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>
            {v}
          </span>
        );
      },
    },
  ];
}
