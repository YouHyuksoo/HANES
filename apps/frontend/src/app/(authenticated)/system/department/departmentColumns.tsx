import type { MutableRefObject } from "react";
import type { TFunction } from "i18next";
import type { ColumnDef } from "@tanstack/react-table";
import { Edit2, Trash2 } from "lucide-react";
import type { Department } from "./types";

interface CreateDepartmentGridColumnsOptions {
  t: TFunction;
  isPanelOpen: boolean;
  panelAnimateRef: MutableRefObject<boolean>;
  onEditDepartment: (department: Department) => void;
  onDeleteDepartment: (department: Department) => void;
}

export function createDepartmentGridColumns({
  t,
  isPanelOpen,
  panelAnimateRef,
  onEditDepartment,
  onDeleteDepartment,
}: CreateDepartmentGridColumnsOptions): ColumnDef<Department>[] {
  return [
    {
      id: "actions",
      header: t("common.actions", "관리"),
      size: 100,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              panelAnimateRef.current = !isPanelOpen;
              onEditDepartment(row.original);
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteDepartment(row.original);
            }}
            className="p-1 hover:bg-surface rounded"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    { accessorKey: "deptCode", header: t("system.department.deptCode", "부서코드"), size: 120, meta: { filterType: "text" as const } },
    { accessorKey: "deptName", header: t("system.department.deptName", "부서명"), size: 180, meta: { filterType: "text" as const } },
    {
      accessorKey: "parentDeptCode",
      header: t("system.department.parentDeptCode", "상위부서"),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue<string | null>() || "-",
    },
    { accessorKey: "sortOrder", header: t("system.department.sortOrder", "정렬순서"), size: 80, meta: { filterType: "number" as const } },
    {
      accessorKey: "managerName",
      header: t("system.department.managerName", "부서장"),
      size: 120,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue<string | null>() || "-",
    },
    {
      accessorKey: "useYn",
      header: t("system.department.useYn", "사용여부"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return (
          <span
            className={`px-2 py-1 text-xs rounded-full ${
              v === "Y"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {v === "Y" ? t("common.yes", "사용") : t("common.no", "미사용")}
          </span>
        );
      },
    },
    {
      accessorKey: "remark",
      header: t("system.department.remark", "비고"),
      size: 200,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => getValue<string | null>() || "-",
    },
  ];
}
