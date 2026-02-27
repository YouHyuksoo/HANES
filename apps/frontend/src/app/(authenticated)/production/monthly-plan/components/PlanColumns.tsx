/**
 * @file production/monthly-plan/components/PlanColumns.tsx
 * @description 월간생산계획 DataGrid 컬럼 정의 훅
 *
 * 초보자 가이드:
 * 1. **usePlanColumns**: DataGrid에 전달할 컬럼 정의를 반환하는 훅
 * 2. **ComCodeBadge**: 상태 컬럼에 공통코드 배지 표시
 * 3. **발행률**: orderQty / planQty 프로그레스 바
 */

"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import { ProdPlanItem } from "./types";

interface UsePlanColumnsParams {
  onConfirm?: (item: ProdPlanItem) => void;
  onUnconfirm?: (item: ProdPlanItem) => void;
}

export function usePlanColumns({ onConfirm, onUnconfirm }: UsePlanColumnsParams = {}) {
  const { t } = useTranslation();

  return useMemo<ColumnDef<ProdPlanItem>[]>(() => [
    {
      accessorKey: "planNo",
      header: t("monthlyPlan.planNo"),
      size: 160,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{getValue() as string}</span>
      ),
    },
    {
      id: "actions",
      header: t("common.actions"),
      size: 80,
      meta: { filterType: "none" as const, align: "center" as const },
      cell: ({ row }) => {
        const item = row.original;
        if (item.status === "DRAFT" && onConfirm) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); onConfirm(item); }}
              className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
            >
              {t("monthlyPlan.confirm")}
            </button>
          );
        }
        if (item.status === "CONFIRMED" && onUnconfirm) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); onUnconfirm(item); }}
              className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
            >
              {t("monthlyPlan.unconfirm")}
            </button>
          );
        }
        return null;
      },
    },
    {
      accessorKey: "itemType",
      header: t("monthlyPlan.itemType"),
      size: 70,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => {
        const v = getValue() as string;
        const cls = v === "FG"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
        return <span className={`px-2 py-0.5 text-xs rounded-full ${cls}`}>{v}</span>;
      },
    },
    {
      id: "partCode",
      header: t("common.partCode"),
      size: 110,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemCode || row.itemCode,
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{(getValue() as string) || "-"}</span>
      ),
    },
    {
      id: "partName",
      header: t("common.partName"),
      size: 150,
      meta: { filterType: "text" as const },
      accessorFn: (row) => row.part?.itemName || "",
    },
    {
      accessorKey: "planQty",
      header: t("monthlyPlan.planQty"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span className="font-medium">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      accessorKey: "orderQty",
      header: t("monthlyPlan.orderQty"),
      size: 90,
      meta: { filterType: "number" as const, align: "right" as const },
      cell: ({ getValue }) => (
        <span>{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: "issueRate",
      header: t("monthlyPlan.issueRate"),
      size: 120,
      meta: { filterType: "none" as const },
      cell: ({ row }) => {
        const { planQty, orderQty } = row.original;
        const rate = planQty > 0 ? Math.min(Math.round((orderQty / planQty) * 100), 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${rate >= 100 ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${rate}%` }}
              />
            </div>
            <span className="text-xs text-text-muted w-10">{rate}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "lineCode",
      header: t("monthlyPlan.lineCode"),
      size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "customer",
      header: t("monthlyPlan.customer"),
      size: 90,
      meta: { filterType: "text" as const },
      cell: ({ getValue }) => (getValue() as string) || "-",
    },
    {
      accessorKey: "priority",
      header: t("monthlyPlan.priority"),
      size: 60,
      meta: { filterType: "number" as const, align: "center" as const },
    },
    {
      accessorKey: "status",
      header: t("common.status"),
      size: 80,
      meta: { filterType: "multi" as const },
      cell: ({ getValue }) => (
        <ComCodeBadge groupCode="PROD_PLAN_STATUS" code={getValue() as string} />
      ),
    },
  ], [t, onConfirm, onUnconfirm]);
}
