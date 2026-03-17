"use client";

/**
 * @file master/process/components/ProcessList.tsx
 * @description 공정관리 좌측 패널 - DataGrid 형태의 공정 목록
 *
 * 초보자 가이드:
 * 1. DataGrid로 공정 목록 표시, 행 클릭 시 우측에 설비 표시
 * 2. 선택된 행 하이라이트 (selectedRowId)
 * 3. 수정/삭제 액션 버튼 포함
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Edit2, Trash2, Plus, Search } from "lucide-react";
import { Card, CardContent, ComCodeBadge, Button, Input } from "@/components/ui";
import DataGrid from "@/components/data-grid/DataGrid";
import { useComCodeOptions } from "@/hooks/useComCode";
import { ColumnDef } from "@tanstack/react-table";

export interface Process {
  processCode: string;
  processName: string;
  processType: string;
  processCategory?: string;
  sortOrder: number;
  remark?: string;
  useYn: string;
}

interface ProcessListProps {
  processes: Process[];
  selectedCode: string;
  onSelect: (code: string) => void;
  isLoading: boolean;
  equipCounts: Record<string, number>;
  onAdd: () => void;
  onEdit: (item: Process) => void;
  onDelete: (item: Process) => void;
}

export default function ProcessList({
  processes,
  selectedCode,
  onSelect,
  isLoading,
  equipCounts,
  onAdd,
  onEdit,
  onDelete,
}: ProcessListProps) {
  const { t } = useTranslation();

  const processCategoryOptions = useMemo(
    () => [
      { value: "ASSY", label: t("master.process.catAssy") },
      { value: "INSP", label: t("master.process.catInsp") },
      { value: "CUTTING", label: t("master.process.catCutting") },
      { value: "WELDING", label: t("master.process.catWelding") },
      { value: "PACKING", label: t("master.process.catPacking") },
    ],
    [t],
  );

  const columns = useMemo<ColumnDef<Process>[]>(
    () => [
      {
        id: "actions",
        header: "",
        size: 60,
        meta: { align: "center" as const, filterType: "none" as const },
        cell: ({ row }) => (
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(row.original);
              }}
              className="p-1 hover:bg-surface rounded"
            >
              <Edit2 className="w-3.5 h-3.5 text-primary" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row.original);
              }}
              className="p-1 hover:bg-surface rounded"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
            </button>
          </div>
        ),
      },
      {
        accessorKey: "processCode",
        header: t("master.process.processCode"),
        size: 100,
      },
      {
        accessorKey: "processName",
        header: t("master.process.processName"),
        size: 140,
      },
      {
        accessorKey: "processType",
        header: t("master.process.processType"),
        size: 90,
        cell: ({ getValue }) => (
          <ComCodeBadge groupCode="PROCESS_TYPE" code={getValue() as string} />
        ),
      },
      {
        accessorKey: "processCategory",
        header: t("master.process.processCategory"),
        size: 80,
        meta: {
          filterType: "multi" as const,
          filterOptions: processCategoryOptions,
        },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return v ? (
            <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
              {v}
            </span>
          ) : (
            "-"
          );
        },
      },
      {
        id: "equipCount",
        header: t("master.process.equipCount"),
        size: 60,
        meta: { align: "center" as const, filterType: "none" as const },
        cell: ({ row }) => {
          const count = equipCounts[row.original.processCode] ?? 0;
          return (
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${
                count > 0
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                  : "bg-surface text-text-muted"
              }`}
            >
              {count}
            </span>
          );
        },
      },
      {
        accessorKey: "sortOrder",
        header: t("master.process.sortOrder"),
        size: 60,
      },
      {
        accessorKey: "useYn",
        header: t("common.useYn", { defaultValue: "사용여부" }),
        size: 50,
        meta: { filterType: "multi" as const },
        cell: ({ getValue }) => {
          const v = getValue() as string;
          return (
            <span
              className={`px-1.5 py-0.5 text-xs rounded ${
                v === "Y"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              }`}
            >
              {v}
            </span>
          );
        },
      },
    ],
    [t, equipCounts, onEdit, onDelete, processCategoryOptions],
  );

  return (
    <Card className="flex-1 flex flex-col min-h-0">
      <CardContent className="flex-1 min-h-0 overflow-hidden">
        <DataGrid
          data={processes}
          columns={columns}
          isLoading={isLoading}
          enableColumnFilter
          enableExport
          exportFileName={t("master.process.title")}
          onRowClick={(row) => onSelect(row.processCode)}
          selectedRowId={selectedCode}
          getRowId={(row) => row.processCode}
          toolbarLeft={
            <Button size="sm" onClick={onAdd}>
              <Plus className="w-4 h-4 mr-1" />
              {t("master.process.addProcess")}
            </Button>
          }
        />
      </CardContent>
    </Card>
  );
}
