"use client";

import type { TFunction } from "i18next";
import { Edit2, Trash2 } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { WorkerAvatar } from "@/components/worker/WorkerSelector";
import { Worker } from "./types";

interface CreateWorkerGridColumnsOptions {
  t: TFunction;
  onEditWorker: (worker: Worker) => void;
  onDeleteWorker: (worker: Worker) => void;
}

export function createWorkerGridColumns({
  t,
  onEditWorker,
  onDeleteWorker,
}: CreateWorkerGridColumnsOptions): ColumnDef<Worker>[] {
  return [
    {
      id: "actions", header: t("common.actions"), size: 80,
      meta: { align: "center" as const, filterType: "none" as const },
      cell: ({ row }) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); onEditWorker(row.original); }} className="p-1 hover:bg-surface rounded">
            <Edit2 className="w-4 h-4 text-primary" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDeleteWorker(row.original); }} className="p-1 hover:bg-surface rounded">
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      ),
    },
    {
      id: "photo", header: t("master.worker.photo", "사진"), size: 60,
      meta: { filterType: "none" as const },
      cell: ({ row }) => <WorkerAvatar name={row.original.workerName} dept={row.original.dept ?? ""} photoUrl={row.original.photoUrl} />,
    },
    { accessorKey: "workerCode", header: t("master.worker.workerCode", "작업자코드"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "workerName", header: t("master.worker.workerName", "작업자명"), size: 100, meta: { filterType: "text" as const } },
    { accessorKey: "engName", header: t("master.worker.engName", "영문명"), size: 100, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "dept", header: t("master.worker.dept", "부서"), size: 90, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "position", header: t("master.worker.position", "직급"), size: 80, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    { accessorKey: "phone", header: t("master.worker.phone", "전화번호"), size: 120, meta: { filterType: "text" as const }, cell: ({ getValue }) => getValue() || "-" },
    {
      accessorKey: "useYn", header: t("master.worker.use", "사용"), size: 60,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${
            v === "Y"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}>
            {v === "Y" ? t("common.yes", "사용") : t("common.no", "미사용")}
          </span>
        );
      },
    },
  ];
}
