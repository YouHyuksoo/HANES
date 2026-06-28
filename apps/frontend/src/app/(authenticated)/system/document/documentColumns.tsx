"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { AlertTriangle, Pencil } from "lucide-react";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 문서 데이터 타입 */
export interface Document {
  docNo: string;
  docTitle: string;
  docType: string;
  category: string;
  revisionNo: number;
  revisionDate: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
  filePath: string;
  retentionPeriod: number;
  expiresAt: string;
  description: string;
  createdAt: string;
}

/** 만료 30일 이내 여부 판단 */
export function isExpiringSoon(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const diff = new Date(expiresAt).getTime() - Date.now();
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}

interface CreateDocumentGridColumnsOptions {
  t: TFunction;
  onEditDocument: (doc: Document) => void;
}

export function createDocumentGridColumns({
  t,
  onEditDocument,
}: CreateDocumentGridColumnsOptions): ColumnDef<Document>[] {
  return [
    {
      id: "actions", header: "", size: 60,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <button
          onClick={(e) => { e.stopPropagation(); onEditDocument(row.original); }}
          className="p-1 hover:bg-surface rounded transition-colors" title={t("common.edit", "수정")}
        >
          <Pencil className="w-4 h-4 text-primary" />
        </button>
      ),
    },
    { accessorKey: "docNo", header: t("system.document.docNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => <span className="text-primary font-medium">{getValue() as string}</span> },
    { accessorKey: "docTitle", header: t("system.document.docTitle"), size: 220,
      meta: { filterType: "text" as const } },
    { accessorKey: "docType",
      header: () => <StatusHeaderHelp label={t("system.document.docType")} codeType="DOC_TYPE" align="center" />,
      size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="DOC_TYPE" code={getValue() as string} /> },
    { accessorKey: "category", header: t("system.document.category"), size: 120,
      meta: { filterType: "text" as const } },
    { accessorKey: "revisionNo", header: t("system.document.revisionNo"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => <span className="font-mono text-center block">Rev.{getValue() as number}</span> },
    { accessorKey: "revisionDate", header: t("system.document.revisionDate"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10) },
    { accessorKey: "status",
      header: () => <StatusHeaderHelp label={t("common.status")} codeType="DOC_STATUS" align="center" />,
      size: 110,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => <ComCodeBadge groupCode="DOC_STATUS" code={getValue() as string} /> },
    { accessorKey: "approvedBy", header: t("system.document.approvedBy"), size: 100,
      meta: { filterType: "text" as const } },
    { accessorKey: "expiresAt", header: t("system.document.expiresAt"), size: 110,
      meta: { filterType: "date" as const },
      cell: ({ row }) => {
        const v = row.original.expiresAt;
        if (!v) return "-";
        const soon = isExpiringSoon(v);
        return (
          <span className={soon ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
            {soon && <AlertTriangle className="w-3 h-3 inline mr-1" />}
            {v.slice(0, 10)}
          </span>
        );
      },
    },
  ];
}
