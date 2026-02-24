/**
 * @file src/components/data-grid/NumberFilterPopup.tsx
 * @description 숫자 컬럼 범위 필터 팝업 — AG Grid 스타일
 *
 * 초보자 가이드:
 * 1. `createPortal`로 `document.body`에 렌더링 (overflow 영향 방지)
 * 2. 상단: 체크박스 목록 (Select All + 고유 숫자값)
 * 3. 하단: 범위 조건 (연산자 드롭다운 + 값 입력) × 2, And/Or 연결자
 * 4. Footer: Filter / Clear Filter 버튼
 * 5. 외부 클릭 / ESC 키로 닫기
 */
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Column } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import type { NumberFilterValue, NumberOperator } from "./numberFilterFn";
import { EMPTY_NUMBER_FILTER } from "./numberFilterFn";

interface NumberFilterPopupProps<T> {
  column: Column<T, unknown>;
  data: T[];
  anchorRect: () => DOMRect | null;
  onClose: () => void;
}

/** NaN을 "(빈값)" 표시용 특수값으로 사용 */
const BLANK_SENTINEL = NaN;

export function NumberFilterPopup<T>({ column, data, anchorRect, onClose }: NumberFilterPopupProps<T>) {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);
  const currentFilter = (column.getFilterValue() as NumberFilterValue | undefined) ?? EMPTY_NUMBER_FILTER;

  // --- 고유값 추출 ---
  const uniqueValues = useMemo(() => {
    const vals = new Set<number>();
    let hasBlank = false;
    data.forEach((row) => {
      const raw = (row as Record<string, unknown>)[column.id];
      if (raw == null || raw === "") {
        hasBlank = true;
      } else {
        const n = Number(raw);
        if (isNaN(n)) hasBlank = true;
        else vals.add(n);
      }
    });
    const sorted = Array.from(vals).sort((a, b) => a - b);
    if (hasBlank) sorted.push(BLANK_SENTINEL);
    return sorted;
  }, [data, column.id]);

  // --- 로컬 상태 ---
  const [checkedSet, setCheckedSet] = useState<Set<number>>(() => {
    if (currentFilter.checkedValues === null) return new Set(uniqueValues);
    return new Set(currentFilter.checkedValues);
  });
  const [cond1Op, setCond1Op] = useState<NumberOperator>(currentFilter.condition1.operator);
  const [cond1Val, setCond1Val] = useState<string>(currentFilter.condition1.value != null ? String(currentFilter.condition1.value) : "");
  const [connector, setConnector] = useState<"and" | "or">(currentFilter.connector);
  const [cond2Op, setCond2Op] = useState<NumberOperator>(currentFilter.condition2.operator);
  const [cond2Val, setCond2Val] = useState<string>(currentFilter.condition2.value != null ? String(currentFilter.condition2.value) : "");

  const allChecked = checkedSet.size === uniqueValues.length;

  // --- 팝업 위치 ---
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    const rect = anchorRect();
    if (!rect) return;
    const popupH = 420;
    const popupW = 280;
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
    setCheckedSet(allChecked ? new Set() : new Set(uniqueValues));
  }, [allChecked, uniqueValues]);

  const toggleValue = useCallback((val: number) => {
    setCheckedSet((prev) => {
      const next = new Set(prev);
      if (isNaN(val)) {
        const hasBlank = Array.from(prev).some((v) => isNaN(v));
        if (hasBlank) {
          return new Set(Array.from(next).filter((v) => !isNaN(v)));
        }
        next.add(BLANK_SENTINEL);
        return next;
      }
      next.has(val) ? next.delete(val) : next.add(val);
      return next;
    });
  }, []);

  const isValueChecked = useCallback((val: number) => {
    if (isNaN(val)) return Array.from(checkedSet).some((v) => isNaN(v));
    return checkedSet.has(val);
  }, [checkedSet]);

  // --- Filter 적용 ---
  const handleApply = useCallback(() => {
    const isAllSelected = checkedSet.size === uniqueValues.length;
    const checkedValues = isAllSelected ? null : Array.from(checkedSet);
    const filterVal: NumberFilterValue = {
      checkedValues,
      condition1: { operator: cond1Op, value: cond1Val !== "" ? Number(cond1Val) : null },
      connector,
      condition2: { operator: cond2Op, value: cond2Val !== "" ? Number(cond2Val) : null },
    };
    const isEmpty = checkedValues === null && cond1Op === "none" && cond2Op === "none";
    column.setFilterValue(isEmpty ? undefined : filterVal);
    onClose();
  }, [checkedSet, uniqueValues.length, cond1Op, cond1Val, connector, cond2Op, cond2Val, column, onClose]);

  // --- Clear 필터 ---
  const handleClear = useCallback(() => {
    column.setFilterValue(undefined);
    onClose();
  }, [column, onClose]);

  // --- 연산자 옵션 ---
  const operatorOptions: { value: NumberOperator; label: string }[] = useMemo(() => [
    { value: "none", label: t("numberFilter.none") },
    { value: "eq", label: t("numberFilter.eq") },
    { value: "neq", label: t("numberFilter.neq") },
    { value: "gt", label: t("numberFilter.gt") },
    { value: "gte", label: t("numberFilter.gte") },
    { value: "lt", label: t("numberFilter.lt") },
    { value: "lte", label: t("numberFilter.lte") },
    { value: "blank", label: t("numberFilter.blank") },
    { value: "notBlank", label: t("numberFilter.notBlank") },
  ], [t]);

  const needsValue = (op: NumberOperator) => !["none", "blank", "notBlank"].includes(op);

  const inputCls = "w-full h-7 px-2 text-xs bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary";
  const selectCls = "w-full h-7 px-1 text-xs bg-surface border border-border rounded text-text focus:outline-none focus:ring-1 focus:ring-primary";

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-[9999] w-[280px] bg-surface border border-border rounded-lg shadow-xl dark:shadow-black/40 flex flex-col"
      style={{ top: pos.top, left: pos.left, maxHeight: "420px" }}
    >
      {/* 체크박스 목록 */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">
          {t("numberFilter.values")}
        </div>
        <label className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-text hover:bg-primary/5 rounded px-1">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30"
          />
          <span className="font-medium">{t("numberFilter.selectAll")}</span>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-3 max-h-[140px] border-b border-border">
        {uniqueValues.map((val, i) => {
          const isBlank = isNaN(val);
          const display = isBlank ? `(${t("numberFilter.blankLabel")})` : String(val);
          return (
            <label
              key={isBlank ? "blank" : val}
              className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-text hover:bg-primary/5 rounded px-1"
            >
              <input
                type="checkbox"
                checked={isValueChecked(val)}
                onChange={() => toggleValue(val)}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30"
              />
              <span className={isBlank ? "italic text-text-muted" : ""}>{display}</span>
            </label>
          );
        })}
      </div>

      {/* 범위 조건 */}
      <div className="px-3 py-2 space-y-2 border-b border-border">
        <div className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
          {t("numberFilter.conditions")}
        </div>

        {/* Condition 1 */}
        <select value={cond1Op} onChange={(e) => setCond1Op(e.target.value as NumberOperator)} className={selectCls}>
          {operatorOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {needsValue(cond1Op) && (
          <input type="number" value={cond1Val} onChange={(e) => setCond1Val(e.target.value)} placeholder={t("numberFilter.valuePlaceholder")} className={inputCls} />
        )}

        {/* Connector */}
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-text cursor-pointer">
            <input type="radio" name={`conn-${column.id}`} checked={connector === "and"} onChange={() => setConnector("and")} className="w-3 h-3 text-primary focus:ring-primary/30" />
            AND
          </label>
          <label className="flex items-center gap-1 text-xs text-text cursor-pointer">
            <input type="radio" name={`conn-${column.id}`} checked={connector === "or"} onChange={() => setConnector("or")} className="w-3 h-3 text-primary focus:ring-primary/30" />
            OR
          </label>
        </div>

        {/* Condition 2 */}
        <select value={cond2Op} onChange={(e) => setCond2Op(e.target.value as NumberOperator)} className={selectCls}>
          {operatorOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {needsValue(cond2Op) && (
          <input type="number" value={cond2Val} onChange={(e) => setCond2Val(e.target.value)} placeholder={t("numberFilter.valuePlaceholder")} className={inputCls} />
        )}
      </div>

      {/* 버튼 */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={handleClear}
          className="flex-1 h-7 text-xs font-medium rounded border border-border text-text-muted hover:text-text hover:border-border-hover transition-colors bg-surface"
        >
          {t("numberFilter.clear")}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 h-7 text-xs font-semibold rounded bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          {t("numberFilter.apply")}
        </button>
      </div>
    </div>,
    document.body
  );
}
