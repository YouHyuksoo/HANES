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
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";
import { ComCodeBadge } from "@/components/ui";
import { resolveBackendFileUrl } from "@/utils/file-url";
import QtyInput from "@/components/shared/QtyInput";

/** 라벨 발행 가능 마스터 항목 (API 응답) */
export interface LabelableMaster {
  consumableCode: string;
  consumableName: string;
  category: string | null;
  imageUrl: string | null;
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

/** 이미지 썸네일 — 클릭 시 전체화면 라이트박스. 로드 실패 시 placeholder로 fallback */
function LabelImageCell({ src }: { src: string }) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="w-9 h-9 rounded border border-dashed border-border flex items-center justify-center bg-surface">
        <span className="text-text-muted text-xs">-</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="inline-block rounded overflow-hidden hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary transition"
      >
        <img
          src={src}
          alt=""
          onError={() => setErrored(true)}
          className="w-9 h-9 object-cover rounded border border-border bg-surface block"
        />
      </button>
      {zoomed && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-6 cursor-zoom-out"
          onClick={() => setZoomed(false)}
        >
          <div className="flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img
              src={src}
              alt=""
              className="max-h-[80vh] max-w-[80vw] object-contain rounded-lg bg-white shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="px-4 py-1.5 rounded-lg bg-white/15 text-white text-sm hover:bg-white/25 transition"
            >
              {t("common.close", "닫기")}
            </button>
          </div>
        </div>
      )}
    </>
  );
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
        id: "image",
        header: t("consumables.master.sectionImage", "이미지"),
        size: 64,
        meta: { filterType: "none" as const, align: "center" as const },
        cell: ({ row }) => {
          const src = resolveBackendFileUrl(row.original.imageUrl);
          return src ? (
            <LabelImageCell src={src} />
          ) : (
            <span className="text-text-muted text-xs">-</span>
          );
        },
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
            <QtyInput
              value={qtyMap.get(code) ?? 1}
              onChange={(n) => setQty(code, Math.max(1, Math.min(99, n || 1)))}
              maxValue={99}
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
