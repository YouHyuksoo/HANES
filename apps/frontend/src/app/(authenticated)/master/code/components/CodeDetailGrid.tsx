"use client";

/**
 * @file master/code/components/CodeDetailGrid.tsx
 * @description 공통코드 상세 목록 그리드 (우측 패널)
 *
 * 초보자 가이드:
 * 1. **DataGrid**: 상세코드 목록을 테이블로 표시
 * 2. **배지 미리보기**: attr1에 저장된 Tailwind 색상을 직접 렌더링
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Edit2, Trash2 } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { ColumnDef } from "@tanstack/react-table";
import type { ComCodeDetail } from "../types";

interface CodeDetailGridProps {
  groupCode: string;
  codes: ComCodeDetail[];
  isLoading: boolean;
  onEdit: (code: ComCodeDetail) => void;
  onDelete: (code: ComCodeDetail) => void;
}

export default function CodeDetailGrid({
  groupCode,
  codes,
  isLoading,
  onEdit,
  onDelete,
}: CodeDetailGridProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<ComCodeDetail>[]>(
    () => [
      {
        id: "actions",
        header: t("common.actions"),
        size: 90,
        meta: { align: "center" as const, filterType: "none" as const },
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={() => onEdit(row.original)}
              className="p-1 hover:bg-surface rounded"
              title={t("common.edit")}
            >
              <Edit2 className="w-4 h-4 text-primary" />
            </button>
            <button
              onClick={() => onDelete(row.original)}
              className="p-1 hover:bg-surface rounded"
              title={t("common.delete")}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        ),
      },
      {
        accessorKey: "detailCode",
        header: t("master.code.detailCode"),
        size: 140,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-semibold">{getValue<string>()}</span>
        ),
      },
      { accessorKey: "codeName", header: t("master.code.codeName"), size: 130, meta: { filterType: "text" as const } },
      {
        accessorKey: "attr3",
        header: t("master.code.codeNameEn", { defaultValue: "영어명" }),
        size: 150,
        meta: { filterType: "text" as const },
        cell: ({ getValue }) => (
          <span className="text-text-muted">{getValue<string>() || "-"}</span>
        ),
      },
      {
        id: "badge",
        header: t("master.code.badge", { defaultValue: "배지" }),
        size: 120,
        meta: { filterType: "none" as const },
        cell: ({ row }) => {
          const attr1 = row.original.attr1;
          if (!attr1) return <span className="text-text-muted">-</span>;
          return (
            <span className={`px-2 py-0.5 text-xs rounded-full ${attr1}`}>
              {row.original.codeName}
            </span>
          );
        },
      },
      {
        accessorKey: "sortOrder",
        header: t("master.code.sortOrder"),
        size: 80,
        meta: { filterType: "number" as const },
        cell: ({ getValue }) => (
          <span className="text-center block">{getValue<number>()}</span>
        ),
      },
      {
        accessorKey: "useYn",
        header: t("master.code.useYn"),
        size: 80,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => (
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              getValue<string>() === "Y"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {getValue<string>() === "Y"
              ? t("master.code.inUse")
              : t("master.code.notInUse")}
          </span>
        ),
      },
    ],
    [t, onEdit, onDelete],
  );

  return (
    <Card padding="none" className="flex-1 flex flex-col min-h-0">
      <CardHeader
        title={`${groupCode || "..."} — ${t(`comCodeGroup.${groupCode}`, { defaultValue: groupCode })}`}
        subtitle={`${codes.length}${t("master.code.codesCount")}`}
        className="px-4 pt-4"
      />
      <CardContent className="flex-1 flex flex-col min-h-0 px-4 pb-4">
        <DataGrid data={codes} columns={columns} isLoading={isLoading} enableColumnFilter enableExport exportFileName={`${groupCode}_codes`} />
      </CardContent>
    </Card>
  );
}
