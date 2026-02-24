/**
 * @file src/components/data-grid/TextFilterPopup.tsx
 * @description 문자 컬럼 멀티 선택(IN) 필터 팝업 — 체크박스 목록
 *
 * 초보자 가이드:
 * 1. `createPortal`로 `document.body`에 렌더링 (overflow 영향 방지)
 * 2. 검색 입력: 고유값 목록을 검색으로 필터링
 * 3. 체크박스 목록: Select All + 고유 문자값
 * 4. Footer: Filter / Clear Filter 버튼
 * 5. 외부 클릭 / ESC 키로 닫기
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Column } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import type { TextFilterValue } from "./textFilterFn";
import { BLANK_TEXT } from "./textFilterFn";

interface TextFilterPopupProps<T> {
  column: Column<T, unknown>;
  data: T[];
  anchorRect: () => DOMRect | null;
  onClose: () => void;
}

export function TextFilterPopup<T>({ column, data, anchorRect, onClose }: TextFilterPopupProps<T>) {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);
  const currentFilter = column.getFilterValue() as TextFilterValue | undefined;

  // --- 고유값 추출 ---
  const uniqueValues = useMemo(() => {
    const vals = new Set<string>();
    let hasBlank = false;
    data.forEach((row) => {
      const raw = (row as Record<string, unknown>)[column.id];
      if (raw == null || raw === "") {
        hasBlank = true;
      } else {
        vals.add(String(raw));
      }
    });
    const sorted = Array.from(vals).sort((a, b) => a.localeCompare(b));
    if (hasBlank) sorted.push(BLANK_TEXT);
    return sorted;
  }, [data, column.id]);

  // --- 로컬 상태 ---
  const [checkedSet, setCheckedSet] = useState<Set<string>>(() => {
    if (!currentFilter || currentFilter.checkedValues === null) return new Set(uniqueValues);
    return new Set(currentFilter.checkedValues);
  });
  const [search, setSearch] = useState("");

  // 검색 필터링된 고유값
  const filteredValues = useMemo(() => {
    if (!search) return uniqueValues;
    const lower = search.toLowerCase();
    return uniqueValues.filter((v) =>
      v === BLANK_TEXT ? t("textFilter.blankLabel").toLowerCase().includes(lower) : v.toLowerCase().includes(lower)
    );
  }, [uniqueValues, search, t]);

  const allFilteredChecked = filteredValues.every((v) => checkedSet.has(v));

  // --- 팝업 위치 ---
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const rect = anchorRect();
    if (!rect) return;
    const popupH = 360;
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

  // --- 체크박스 핸들러 ---
  const toggleAll = useCallback(() => {
    setCheckedSet((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) {
        filteredValues.forEach((v) => next.delete(v));
      } else {
        filteredValues.forEach((v) => next.add(v));
      }
      return next;
    });
  }, [allFilteredChecked, filteredValues]);

  const toggleValue = useCallback((val: string) => {
    setCheckedSet((prev) => {
      const next = new Set(prev);
      next.has(val) ? next.delete(val) : next.add(val);
      return next;
    });
  }, []);

  // --- Filter 적용 ---
  const handleApply = useCallback(() => {
    const isAllSelected = checkedSet.size === uniqueValues.length;
    if (isAllSelected) {
      column.setFilterValue(undefined);
    } else {
      column.setFilterValue({ checkedValues: Array.from(checkedSet) } as TextFilterValue);
    }
    onClose();
  }, [checkedSet, uniqueValues.length, column, onClose]);

  // --- Clear 필터 ---
  const handleClear = useCallback(() => {
    column.setFilterValue(undefined);
    onClose();
  }, [column, onClose]);

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-[260px] bg-surface border border-border rounded-lg shadow-xl dark:shadow-black/40 flex flex-col"
      style={{ top: pos.top, left: pos.left, maxHeight: "360px" }}
    >
      {/* 검색 */}
      <div className="px-3 pt-3 pb-1">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("textFilter.searchPlaceholder")}
          className="w-full h-7 px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
          autoFocus
        />
      </div>

      {/* Select All */}
      <div className="px-3 pt-1 pb-0.5">
        <label className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-text hover:bg-primary/5 rounded px-1">
          <input
            type="checkbox"
            checked={allFilteredChecked}
            onChange={toggleAll}
            className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30"
          />
          <span className="font-medium">{t("textFilter.selectAll")}</span>
          <span className="ml-auto text-[10px] text-text-muted">{filteredValues.length}</span>
        </label>
      </div>

      {/* 체크박스 목록 */}
      <div className="flex-1 overflow-y-auto px-3 max-h-[200px] border-t border-border mt-1">
        {filteredValues.map((val) => {
          const isBlank = val === BLANK_TEXT;
          const display = isBlank ? `(${t("textFilter.blankLabel")})` : val;
          return (
            <label
              key={val}
              className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-text hover:bg-primary/5 rounded px-1"
            >
              <input
                type="checkbox"
                checked={checkedSet.has(val)}
                onChange={() => toggleValue(val)}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30"
              />
              <span className={`truncate ${isBlank ? "italic text-text-muted" : ""}`}>{display}</span>
            </label>
          );
        })}
        {filteredValues.length === 0 && (
          <p className="text-xs text-text-muted py-3 text-center">{t("textFilter.noMatch")}</p>
        )}
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 h-7 text-xs font-medium rounded border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors bg-surface"
        >
          {t("textFilter.clear")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-7 text-xs font-semibold rounded bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          {t("textFilter.apply")}
        </button>
      </div>
    </div>,
    document.body
  );
}
