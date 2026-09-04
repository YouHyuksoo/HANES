"use client";

/**
 * @file src/components/shared/MultiSelectFilter.tsx
 * @description 복수 선택 조건 필터 — 툴바용 드롭다운(체크박스 목록)
 *
 * 초보자 가이드:
 * 1. 단일 `Select` 필터와 같은 자리에 놓는 복수 선택 버전. 값은 `string[]`로 주고받는다.
 * 2. 트리거 버튼 요약: 미선택 → "라벨: 전체", 1건 → 해당 라벨, 2건 이상 → "선택 N건".
 * 3. 팝업은 `createPortal`로 body에 띄워 DataGrid 툴바의 overflow에 잘리지 않는다.
 * 4. 옵션이 많으면(기본 8개 초과) 검색 입력을 자동 노출한다. 전체 선택/해제, 초기화 제공.
 * 5. 체크 즉시 `onChange`가 호출된다(적용 버튼 없음). 외부 클릭/ESC로 닫힌다.
 * 6. 서버 전송 시에는 보통 `values.join(",")`로 쉼표 구분 문자열을 보낸다(백엔드 parseCsvList와 짝).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, X } from "lucide-react";
import type { SelectOption } from "@/components/ui/Select";

export interface MultiSelectFilterProps {
  options: SelectOption[];
  value: string[];
  onChange: (values: string[]) => void;
  /** 트리거 요약 앞에 붙는 라벨 (예: "공정") */
  labelPrefix?: string;
  /** 미선택 상태 문구 (기본: 전체) */
  allLabel?: string;
  /** 검색 입력을 노출할 최소 옵션 수 (기본 8) */
  searchThreshold?: number;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  /** 팝업 가로 폭(px). 기본 280 */
  popupWidth?: number;
}

const POPUP_MAX_H = 360;

export default function MultiSelectFilter({
  options,
  value,
  onChange,
  labelPrefix,
  allLabel,
  searchThreshold = 8,
  fullWidth = false,
  disabled = false,
  className = "",
  popupWidth = 280,
}: MultiSelectFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const selected = useMemo(() => new Set(value), [value]);
  const showSearch = options.length > searchThreshold;

  const filtered = useMemo(() => {
    if (!search) return options;
    const q = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, search]);

  const allFilteredChecked = filtered.length > 0 && filtered.every((o) => selected.has(o.value));

  /** 트리거 요약 문구 */
  const summary = useMemo(() => {
    const all = allLabel ?? t("common.all", "전체");
    if (value.length === 0) return labelPrefix ? `${labelPrefix}: ${all}` : all;
    if (value.length === 1) {
      const label = options.find((o) => o.value === value[0])?.label ?? value[0];
      return labelPrefix ? `${labelPrefix}: ${label}` : label;
    }
    const count = t("common.selectedCount", { count: value.length, defaultValue: `선택 ${value.length}건` });
    return labelPrefix ? `${labelPrefix}: ${count}` : count;
  }, [value, options, labelPrefix, allLabel, t]);

  // --- 팝업 위치 ---
  useEffect(() => {
    if (!open) return;
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + POPUP_MAX_H > window.innerHeight) top = Math.max(4, rect.top - POPUP_MAX_H - 4);
    if (left + popupWidth > window.innerWidth) left = window.innerWidth - popupWidth - 8;
    if (left < 4) left = 4;
    setPos({ top, left });
  }, [open, popupWidth]);

  // --- 외부 클릭 / ESC 닫기 ---
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (popupRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => { if (!open) setSearch(""); }, [open]);

  const toggleValue = useCallback((v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    // 옵션 순서를 유지해 서버 파라미터/표시가 안정적이도록 정렬
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  }, [selected, onChange, options]);

  const toggleAllFiltered = useCallback(() => {
    const next = new Set(selected);
    if (allFilteredChecked) filtered.forEach((o) => next.delete(o.value));
    else filtered.forEach((o) => next.add(o.value));
    onChange(options.filter((o) => next.has(o.value)).map((o) => o.value));
  }, [selected, filtered, allFilteredChecked, onChange, options]);

  const clearAll = useCallback(() => onChange([]), [onChange]);

  const isActive = value.length > 0;

  return (
    <div className={`${fullWidth ? "w-full" : ""} ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`
          h-10 px-3 pr-9 relative bg-surface border rounded-lg text-sm text-left
          transition-all duration-200 cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${fullWidth ? "w-full" : ""}
          ${isActive ? "border-primary text-text" : "border-border text-text-muted"}
        `}
      >
        <span className="block truncate">{summary}</span>
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={popupRef}
          role="listbox"
          aria-multiselectable="true"
          className="fixed z-[9999] bg-surface border border-border rounded-lg shadow-xl dark:shadow-black/40 flex flex-col"
          style={{ top: pos.top, left: pos.left, width: popupWidth, maxHeight: POPUP_MAX_H }}
        >
          {showSearch && (
            <div className="px-3 pt-3 pb-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("common.searchPlaceholder", "검색...")}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className="w-full h-7 px-2 text-xs bg-surface border border-border rounded text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
            </div>
          )}

          <div className="px-3 pt-2 pb-0.5">
            <label className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-text hover:bg-primary/5 rounded px-1">
              <input
                type="checkbox"
                checked={allFilteredChecked}
                onChange={toggleAllFiltered}
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30"
              />
              <span className="font-medium">{allFilteredChecked ? t("common.deselectAll", "전체 해제") : t("common.selectAll", "전체 선택")}</span>
              <span className="ml-auto text-[10px] text-text-muted tabular-nums">{value.length}/{options.length}</span>
            </label>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-1 border-t border-border mt-1">
            {filtered.length === 0 && (
              <div className="py-3 text-center text-xs text-text-muted">{t("common.noData", "데이터 없음")}</div>
            )}
            {filtered.map((o) => {
              const checked = selected.has(o.value);
              return (
                <label
                  key={o.value}
                  role="option"
                  aria-selected={checked}
                  className="flex items-center gap-2 py-0.5 cursor-pointer text-xs text-text hover:bg-primary/5 rounded px-1"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleValue(o.value)}
                    className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary/30"
                  />
                  <span className="truncate">{o.label}</span>
                  {checked && <Check className="w-3 h-3 ml-auto text-primary flex-shrink-0" />}
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-t border-border">
            <button
              type="button"
              onClick={clearAll}
              disabled={!isActive}
              className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-3 h-3" />{t("common.clear", "초기화")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("common.close", "닫기")}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
