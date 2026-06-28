"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import { type Partner } from "./components/PartnerFormPanel";

interface CreatePartnerGridColumnsOptions {
  t: TFunction;
  onEditPartner: (partner: Partner) => void;
  onDeletePartner: (partner: Partner) => void;
}

export function createPartnerGridColumns({
  t,
  onEditPartner,
  onDeletePartner,
}: CreatePartnerGridColumnsOptions): ColumnDef<Partner>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEditPartner(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeletePartner(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "partnerCode", header: t("master.partner.partnerCode"), size: 120 },
    { accessorKey: "partnerName", header: t("master.partner.partnerName"), size: 200 },
    {
      accessorKey: "partnerType", header: t("master.partner.partnerType"), size: 80,
      cell: ({ getValue }) => <ComCodeBadge groupCode="PARTNER_TYPE" code={getValue() as string} />,
    },
    { accessorKey: "bizNo", header: t("master.partner.bizNo"), size: 130 },
    { accessorKey: "ceoName", header: t("master.partner.ceoName"), size: 90 },
    { accessorKey: "tel", header: t("master.partner.tel"), size: 130 },
    { accessorKey: "contactPerson", header: t("master.partner.contactPerson"), size: 90 },
    { accessorKey: "email", header: t("master.partner.email"), size: 180 },
    {
      accessorKey: "useYn", header: t("common.useYn", "사용여부"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-1.5 py-0.5 text-xs rounded ${v === "Y"
            ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"}`}>{v === "Y" ? "Y" : "N"}</span>
        );
      },
    },
  ];
}
