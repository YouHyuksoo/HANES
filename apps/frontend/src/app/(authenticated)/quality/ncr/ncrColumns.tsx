"use client";

/**
 * @file quality/ncr/ncrColumns.tsx
 * @description 부적합 보고서 목록 컬럼
 */
import { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import ComCodeBadge from "@/components/ui/ComCodeBadge";
import StatusBadge from "@/components/shared/StatusBadge";
import type { NcrReport } from "./types";

export function createNcrGridColumns({ t }: { t: TFunction }): ColumnDef<NcrReport>[] {
  return [
    {
      accessorKey: "ncrNo", header: t("quality.ncr.ncrNo", "NCR 번호"), size: 150,
      cell: ({ getValue }) => <span className="font-mono text-xs text-primary">{getValue() as string}</span>,
    },
    {
      accessorKey: "issuedAt", header: t("quality.ncr.issuedAt", "발행일"), size: 110,
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10),
    },
    {
      accessorKey: "targetType", header: t("quality.ncr.targetType", "대상구분"), size: 100,
      cell: ({ getValue }) => <ComCodeBadge groupCode="NCR_TARGET_TYPE" code={getValue() as string} />,
    },
    {
      accessorKey: "foundStage", header: t("quality.ncr.foundStage", "발견단계"), size: 140,
      cell: ({ getValue }) => <ComCodeBadge groupCode="NCR_FOUND_STAGE" code={getValue() as string} />,
    },
    { accessorKey: "itemCode", header: t("common.partCode", "품번"), size: 160 },
    {
      accessorKey: "lotNo", header: t("quality.ncr.lotNo", "로트번호"), size: 140,
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "defectQty", header: t("quality.ncr.defectQty", "불량수량"), size: 90,
      meta: { align: "right" as const },
      cell: ({ getValue }) => {
        const v = getValue() as number | null;
        return v === null ? "-" : v.toLocaleString();
      },
    },
    {
      accessorKey: "defectGrade", header: t("quality.ncr.defectGrade", "결함구분"), size: 100,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <StatusBadge codeType="DEFECT_GRADE" value={v} /> : "-";
      },
    },
    {
      accessorKey: "disposition", header: t("quality.ncr.disposition", "처리방안"), size: 110,
      cell: ({ getValue }) => {
        const v = getValue() as string | null;
        return v ? <ComCodeBadge groupCode="NCR_DISPOSITION" code={v} /> : "-";
      },
    },
    {
      accessorKey: "dueDate", header: t("quality.ncr.dueDate", "회신요구일"), size: 110,
      cell: ({ getValue }) => String(getValue() ?? "").slice(0, 10) || "-",
    },
    {
      accessorKey: "status", header: t("common.status", "상태"), size: 100,
      cell: ({ getValue }) => <ComCodeBadge groupCode="NCR_STATUS" code={getValue() as string} />,
    },
  ];
}
