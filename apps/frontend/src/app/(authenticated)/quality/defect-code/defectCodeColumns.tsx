"use client";

import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";

export interface DefectCode {
  defectCode: string;
  defectName: string;
  categoryCode: string;
  defectGrade: "CRITICAL" | "MAJOR" | "MINOR";
  defectScope: "RAW_MATERIAL" | "PRODUCT" | "PROCESS" | "COMMON";
  productTypes: string[];
  description?: string | null;
  sortOrder?: number;
  useYn: string;
}

interface CreateDefectCodeGridColumnsOptions {
  t: TFunction;
  categoryLevels: (categoryCode: string) => { level1: string; level2: string; level3: string };
  formatDefectGrade: (grade: DefectCode["defectGrade"]) => string;
  formatDefectScope: (scope: DefectCode["defectScope"]) => string;
}

export function createDefectCodeGridColumns({
  t,
  categoryLevels,
  formatDefectGrade,
  formatDefectScope,
}: CreateDefectCodeGridColumnsOptions): ColumnDef<DefectCode>[] {
  return [
    {
      accessorKey: "defectCode",
      header: t("quality.defectCode.defectCode", "불량코드"),
      size: 110,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold text-primary">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "defectName",
      header: t("quality.defectCode.defectName", "불량명"),
      size: 150,
      meta: { filterType: "text" as const },
    },
    {
      id: "level1",
      header: t("quality.defectCode.level1", "1레벨"),
      size: 90,
      meta: { filterType: "text" as const },
      accessorFn: (row) => categoryLevels(row.categoryCode).level1,
      cell: ({ getValue }) => <span className="text-xs text-text-muted">{getValue() as string}</span>,
    },
    {
      id: "level2",
      header: t("quality.defectCode.level2", "2레벨"),
      size: 90,
      meta: { filterType: "text" as const },
      accessorFn: (row) => categoryLevels(row.categoryCode).level2,
      cell: ({ getValue }) => <span className="text-xs text-text-muted">{getValue() as string}</span>,
    },
    {
      id: "level3",
      header: t("quality.defectCode.level3", "3레벨"),
      size: 90,
      meta: { filterType: "text" as const },
      accessorFn: (row) => categoryLevels(row.categoryCode).level3,
      cell: ({ getValue }) => <span className="text-xs text-text-muted">{getValue() as string}</span>,
    },
    {
      accessorKey: "defectGrade",
      header: t("quality.defectCode.grade", "등급"),
      size: 65,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => formatDefectGrade(getValue() as DefectCode["defectGrade"]),
    },
    {
      accessorKey: "defectScope",
      header: t("quality.defectCode.scope", "적용범위"),
      size: 75,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => formatDefectScope(getValue() as DefectCode["defectScope"]),
    },
    {
      accessorKey: "useYn",
      header: t("quality.defectCode.useYn", "사용여부"),
      size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={v === "Y" ? "text-green-600 dark:text-green-400" : "text-text-muted"}>
            {v === "Y" ? t("common.use", "사용") : t("common.inactive", "비활성")}
          </span>
        );
      },
    },
  ];
}
