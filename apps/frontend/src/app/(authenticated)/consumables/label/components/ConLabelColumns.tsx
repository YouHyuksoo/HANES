"use client";

/**
 * @file components/ConLabelColumns.tsx
 * @description 소모품 라벨 발행 DataGrid 컬럼 정의 훅
 *
 * 초보자 가이드:
 * 1. 체크박스 컬럼으로 전체/개별 선택 가능
 * 2. 소모품코드, 소모품명, 카테고리, 기존인스턴스수, 발행수량 입력
 * 3. qtyMap을 통해 각 마스터별 발행 수량을 관리
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";

/** 라벨 발행 가능 마스터 항목 (API 응답) */
export interface LabelableMaster {
  consumableCode: string;
  consumableName: string;
  category: string | null;
  stockQty: number;
  expectedLife: number | null;
  location: string | null;
  instanceCount: number;
  pendingCount: number;
}

interface UseConLabelColumnsParams {
  allSelected: boolean;
  selectedCodes: Set<string>;
  toggleAll: (checked: boolean) => void;
  toggleItem: (code: string) => void;
  qtyMap: Map<string, number>;
  setQty: (code: string, qty: number) => void;
}

/** DataGrid 컬럼 정의 훅 */
export function useConLabelColumns({
  allSelected, selectedCodes, toggleAll, toggleItem, qtyMap, setQty,
}: UseConLabelColumnsParams) {
  const { t } = useTranslation();

  return useMemo<ColumnDef<LabelableMaster>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <input type="checkbox" checked={allSelected}
            onChange={(e) => toggleAll(e.target.checked)}
            className="w-4 h-4 accent-primary" />
        ),
        size: 40,
        meta: { filterType: "none" as const },
        cell: ({ row }) => (
          <input type="checkbox"
            checked={selectedCodes.has(row.original.consumableCode)}
            onChange={() => toggleItem(row.original.consumableCode)}
            className="w-4 h-4 accent-primary" />
        ),
      },
      {
        id: "consumableCode", accessorKey: "consumableCode",
        header: t("consumables.comp.consumableCode"), size: 130,
        meta: { filterType: "text" as const },
        cell: ({ row }) => (
          <span className="font-mono text-xs">{row.original.consumableCode}</span>
        ),
      },
      {
        id: "consumableName", accessorKey: "consumableName",
        header: t("consumables.comp.consumableName"), size: 160,
        meta: { filterType: "text" as const },
      },
      {
        id: "category", accessorKey: "category",
        header: t("consumables.comp.category"), size: 100,
        meta: { filterType: "text" as const },
        cell: ({ row }) => row.original.category
          ? <ComCodeBadge groupCode="CONSUMABLE_CATEGORY" code={row.original.category} />
          : "-",
      },
      {
        id: "stockQty", accessorKey: "stockQty",
        header: t("consumables.comp.currentStock"), size: 80,
        meta: { filterType: "number" as const },
        cell: ({ row }) => row.original.stockQty.toLocaleString(),
      },
      {
        id: "instanceCount", accessorKey: "instanceCount",
        header: t("consumables.label.instanceCount"), size: 100,
        meta: { filterType: "number" as const },
        cell: ({ row }) => {
          const { instanceCount, pendingCount } = row.original;
          return (
            <span>
              {instanceCount}
              {pendingCount > 0 && (
                <span className="ml-1 text-amber-500 dark:text-amber-400 text-xs">
                  ({t("consumables.label.pending")}: {pendingCount})
                </span>
              )}
            </span>
          );
        },
      },
      {
        id: "qty",
        header: t("consumables.label.qtyInput"), size: 100,
        meta: { filterType: "none" as const },
        cell: ({ row }) => {
          const code = row.original.consumableCode;
          return (
            <input
              type="number"
              min={1} max={99}
              value={qtyMap.get(code) ?? 1}
              onChange={(e) => setQty(code, Math.max(1, Math.min(99, Number(e.target.value) || 1)))}
              className="w-16 px-2 py-1 text-center text-sm border border-border rounded bg-surface text-text"
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
      },
    ],
    [t, allSelected, selectedCodes, toggleAll, toggleItem, qtyMap, setQty],
  );
}
