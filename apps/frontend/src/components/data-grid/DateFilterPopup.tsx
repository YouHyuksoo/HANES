/**
 * @file src/components/data-grid/DateFilterPopup.tsx
 * @description 날짜 컬럼 기간 필터 팝업 — From ~ To 날짜 선택
 *
 * 초보자 가이드:
 * 1. `createPortal`로 `document.body`에 렌더링 (overflow 영향 방지)
 * 2. 시작일(From) / 종료일(To) date input 2개
 * 3. Footer: Filter / Clear Filter 버튼
 * 4. 외부 클릭 / ESC 키로 닫기
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Column } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import type { DateFilterValue } from "./dateFilterFn";
import { EMPTY_DATE_FILTER } from "./dateFilterFn";

interface DateFilterPopupProps<T> {
  column: Column<T, unknown>;
  anchorRect: () => DOMRect | null;
  onClose: () => void;
}

export function DateFilterPopup<T>({ column, anchorRect, onClose }: DateFilterPopupProps<T>) {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);
  const currentFilter = (column.getFilterValue() as DateFilterValue | undefined) ?? EMPTY_DATE_FILTER;

  // --- 로컬 상태 ---
  const [from, setFrom] = useState<string>(currentFilter.from ?? "");
  const [to, setTo] = useState<string>(currentFilter.to ?? "");

  // --- 팝업 위치 ---
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const rect = anchorRect();
    if (!rect) return;
    const popupH = 220;
    const popupW = 260;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + popupH > window.innerHeight) top = rect.top - popupH - 4;
    if (left + popupW > window.innerWidth) left = window.innerWidth - popupW - 8;
    if (left < 4) left = 4;
    setPos({ top, left });
  }, [anchorRect]);

  // --- 외부 클릭 닫기 ---
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // --- ESC 닫기 ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // --- Filter 적용 ---
  const handleApply = useCallback(() => {
    const fromVal = from || null;
    const toVal = to || null;
    if (!fromVal && !toVal) {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue({ from: fromVal, to: toVal } as DateFilterValue);
    }
    onClose();
  }, [from, to, column, onClose]);

  // --- Clear 필터 ---
  const handleClear = useCallback(() => {
    column.setFilterValue(undefined);
    onClose();
  }, [column, onClose]);

  const inputCls = "w-full h-8 px-2 text-xs bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary";

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-[260px] bg-surface border border-border rounded-lg shadow-xl dark:shadow-black/40 flex flex-col"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* 기간 선택 */}
      <div className="px-3 pt-3 pb-2 space-y-3">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          {t("dateFilter.title")}
        </div>

        {/* 시작일 */}
        <div>
          <label className="block text-xs text-text mb-1 font-medium">
            {t("dateFilter.from")}
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            max={to || undefined}
            className={inputCls}
          />
        </div>

        {/* 종료일 */}
        <div>
          <label className="block text-xs text-text mb-1 font-medium">
            {t("dateFilter.to")}
          </label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            min={from || undefined}
            className={inputCls}
          />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 h-7 text-xs font-medium rounded border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors bg-surface"
        >
          {t("dateFilter.clear")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-7 text-xs font-semibold rounded bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          {t("dateFilter.apply")}
        </button>
      </div>
    </div>,
    document.body
  );
}
