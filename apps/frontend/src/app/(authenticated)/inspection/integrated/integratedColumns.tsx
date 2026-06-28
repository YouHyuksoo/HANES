"use client";

import type { TFunction } from "i18next";
import { CheckCircle, XCircle } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";

export interface InspectRecord {
  resultNo: string;
  inspectType: string;
  passYn: string;
  fgBarcode: string | null;
  inspectAt: string;
  errorCode: string | null;
  inspectorId: string | null;
}

interface CreateIntegratedGridColumnsOptions {
  t: TFunction;
}

export function createIntegratedGridColumns({
  t,
}: CreateIntegratedGridColumnsOptions): ColumnDef<InspectRecord>[] {
  return [
    {
      accessorKey: "inspectAt", header: t("inspection.result.inspectedAt", "검사시간"),
      size: 150,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v ? new Date(v).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";
      },
    },
    {
      accessorKey: "inspectType", header: t("quality.inspect.inspectType", "검사유형"),
      size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const labels: Record<string, string> = {
          CONTINUITY: t("inspection.integrated.continuity", "회로"),
          LEAK: t("inspection.integrated.leak", "리크"),
          HIPOT: t("inspection.integrated.hipot", "내전압"),
          STRUCTURE: t("inspection.integrated.structure", "구조"),
        };
        return labels[v] ?? v;
      },
    },
    {
      accessorKey: "fgBarcode", header: t("inspection.result.fgBarcode", "FG 바코드"),
      size: 150,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <span className="font-mono text-xs text-primary">{v}</span> : "-";
      },
    },
    {
      accessorKey: "passYn", header: t("quality.inspect.judgement", "판정"),
      size: 80,
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return v === "Y"
          ? <span className="flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle className="w-4 h-4" />{t("quality.inspect.pass")}</span>
          : <span className="flex items-center gap-1 text-red-500 dark:text-red-400"><XCircle className="w-4 h-4" />{t("quality.inspect.fail")}</span>;
      },
    },
    {
      accessorKey: "errorCode", header: t("quality.inspect.defectCode", "불량코드"),
      size: 100,
      cell: ({ getValue }) => getValue() || <span className="text-text-muted">-</span>,
    },
    {
      accessorKey: "inspectorId", header: t("quality.inspect.inspector", "검사원"),
      size: 100, cell: ({ getValue }) => getValue() || "-",
    },
  ];
}
