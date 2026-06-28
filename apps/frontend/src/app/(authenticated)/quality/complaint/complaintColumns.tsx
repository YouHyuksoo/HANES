"use client";

import type { TFunction } from "i18next";
import { FileSearch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 클레임 데이터 타입 */
export interface Complaint {
  complaintNo: string;
  customerCode: string;
  customerName: string;
  complaintDate: string;
  itemCode: string;
  lotNo: string;
  defectQty: number;
  complaintType: string;
  description: string;
  urgency: string;
  status: string;
  responsibleCode: string;
  capaId: string | null;
  costAmount: number | null;
  createdAt: string;
}

interface CreateComplaintGridColumnsOptions {
  t: TFunction;
  onSelectRow: (complaint: Complaint) => void;
}

export function createComplaintGridColumns({
  t,
  onSelectRow,
}: CreateComplaintGridColumnsOptions): ColumnDef<Complaint>[] {
  return [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); onSelectRow(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.detail", "상세")}
        >
          <FileSearch className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "complaintNo", header: t("quality.complaint.complaintNo"), size: 170,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "customerName", header: t("quality.complaint.customerName"), size: 150,
      meta: { filterType: "text" as const } },
    { accessorKey: "complaintDate", header: t("quality.complaint.complaintDate"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
    { accessorKey: "itemCode", header: t("master.bom.itemCode"), size: 120,
      meta: { filterType: "text" as const } },
    { accessorKey: "defectQty", header: t("quality.complaint.defectQty"), size: 90,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-right block">{(getValue() as number)?.toLocaleString()}</span> },
    { accessorKey: "complaintType", header: t("quality.complaint.complaintType"), size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="COMPLAINT_TYPE" code={getValue() as string} /> },
    { accessorKey: "urgency", header: t("quality.complaint.urgency"), size: 90,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="COMPLAINT_URGENCY" code={getValue() as string} /> },
    { accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="COMPLAINT_STATUS" align="center" />, size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="COMPLAINT_STATUS" code={getValue() as string} /> },
    { accessorKey: "responsibleCode", header: t("common.manager"), size: 100,
      meta: { filterType: "text" as const } },
  ];
}
