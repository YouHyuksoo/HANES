"use client";

import type { TFunction } from "i18next";
import { FileSearch } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import StatusHeaderHelp from "@/components/shared/StatusHeaderHelp";

/** 교육 계획 데이터 타입 */
export interface TrainingPlan {
  planNo: string;
  title: string;
  trainingType: string;
  instructor: string;
  scheduledDate: string;
  duration: number;
  maxParticipants: number;
  status: string;
  description: string;
  targetRole: string;
  createdAt: string;
}

interface CreateTrainingGridColumnsOptions {
  t: TFunction;
  onSelectRow: (plan: TrainingPlan) => void;
}

export function createTrainingGridColumns({
  t,
  onSelectRow,
}: CreateTrainingGridColumnsOptions): ColumnDef<TrainingPlan>[] {
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
    {
      accessorKey: "planNo", header: t("system.training.planNo"), size: 150,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="text-primary font-medium">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: "title", header: t("system.training.planTitle"), size: 200,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "trainingType", header: () => <StatusHeaderHelp label={t("system.training.trainingType")} codeType="TRAINING_TYPE" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="TRAINING_TYPE" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "instructor", header: t("system.training.instructor"), size: 120,
      meta: { filterType: "text" as const },
    },
    {
      accessorKey: "scheduledDate", header: t("system.training.scheduledDate"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10),
    },
    {
      accessorKey: "duration", header: t("system.training.duration"), size: 80,
      meta: { filterType: "number" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-right block">
          {getValue() as number}{t("system.training.hours")}
        </span>
      ),
    },
    {
      accessorKey: "status", header: () => <StatusHeaderHelp label={t("common.status")} codeType="TRAINING_STATUS" align="center" />, size: 120,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="TRAINING_STATUS" code={getValue() as string} />
      ),
    },
    {
      accessorKey: "createdAt", header: t("common.createdAt"), size: 120,
      meta: { filterType: "date" as const },
      cell: ({ getValue }) => (getValue() as string)?.slice(0, 10),
    },
  ];
}
