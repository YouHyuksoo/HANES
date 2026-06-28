"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { Company } from "./types";

interface CreateCompanyGridColumnsOptions {
  t: TFunction;
  onEditCompany: (company: Company) => void;
  onDeleteCompany: (company: Company) => void;
}

export function createCompanyGridColumns({
  t,
  onEditCompany,
  onDeleteCompany,
}: CreateCompanyGridColumnsOptions): ColumnDef<Company>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEditCompany(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteCompany(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "companyCode", header: t("master.company.companyCode"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "companyName", header: t("master.company.companyName"), size: 200, meta: { filterType: "text" as const } },
    { accessorKey: "bizNo", header: t("master.company.bizNo"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "ceoName", header: t("master.company.ceoName"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "address", header: t("master.company.address"), size: 250, meta: { filterType: "text" as const } },
    { accessorKey: "tel", header: t("master.company.tel"), size: 140, meta: { filterType: "text" as const } },
    { accessorKey: "email", header: t("master.company.email"), size: 180, meta: { filterType: "text" as const } },
    {
      accessorKey: "useYn", header: t("common.active"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <span className={`w-2 h-2 rounded-full inline-block ${getValue() === "Y" ? "bg-green-500" : "bg-gray-400"}`} />
      ),
    },
  ];
}
