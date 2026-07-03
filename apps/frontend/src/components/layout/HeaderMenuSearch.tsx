"use client";

/**
 * @file src/components/layout/HeaderMenuSearch.tsx
 * @description 상단 헤더 메뉴 검색 — 사이드바 메뉴 트리를 대상으로 이름/코드로 검색해 바로 이동
 *
 * 초보자 가이드:
 * 1. useMenuTree()로 권한 필터링된 메뉴 트리를 받아 리프(경로 있는) 항목만 평탄화
 * 2. Ctrl/Cmd+K로 어디서든 검색창 포커스, 방향키로 결과 탐색, Enter로 이동
 * 3. 클릭 외부 감지로 드롭다운 닫기
 */
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Search, CornerDownLeft } from "lucide-react";
import Input from "@/components/ui/Input";
import { useMenuTree } from "@/hooks/useMenuTree";
import type { MenuConfigItem } from "@/config/menuConfig";

interface SearchableMenuItem {
  code: string;
  path: string;
  label: string;
  breadcrumb: string;
}

const MAX_RESULTS = 8;

function flattenSearchable(
  items: MenuConfigItem[],
  isMenuDisabled: (item: MenuConfigItem) => boolean,
  t: TFunction,
  parentLabel = "",
): SearchableMenuItem[] {
  const result: SearchableMenuItem[] = [];
  for (const item of items) {
    const label = t(item.labelKey, { defaultValue: item.code });
    if (item.path) {
      if (!isMenuDisabled(item)) {
        result.push({
          code: item.code,
          path: item.path,
          label,
          breadcrumb: parentLabel ? `${parentLabel} > ${label}` : label,
        });
      }
      continue;
    }
    if (item.children) {
      result.push(...flattenSearchable(item.children, isMenuDisabled, t, label));
    }
  }
  return result;
}

export default function HeaderMenuSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items, isMenuDisabled } = useMenuTree();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const searchableItems = useMemo(
    () => flattenSearchable(items, isMenuDisabled, t),
    [items, isMenuDisabled, t],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return searchableItems
      .filter((item) =>
        item.label.toLowerCase().includes(q) ||
        item.breadcrumb.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [searchableItems, query]);

  useEffect(() => { setActiveIndex(0); }, [query]);

  // Ctrl/Cmd+K — 어디서든 검색창 포커스
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const goTo = useCallback((item: SearchableMenuItem) => {
    router.push(item.path);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[activeIndex];
      if (target) goTo(target);
    }
  };

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        ref={inputRef}
        placeholder={t("header.searchPlaceholder")}
        leftIcon={<Search className="w-4 h-4" />}
        fullWidth
        className="bg-background"
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="header-menu-search-listbox"
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onKeyDown={handleKeyDown}
      />

      {showDropdown && (
        <ul
          id="header-menu-search-listbox"
          role="listbox"
          aria-label={t("header.searchResultsLabel")}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-80 overflow-y-auto rounded-[var(--radius)] border border-border bg-surface shadow-lg animate-slide-down"
        >
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-text-muted text-center">
              {t("header.searchNoResults")}
            </li>
          ) : (
            results.map((item, index) => (
              <li key={item.code} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => goTo(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    index === activeIndex ? "bg-primary/10 text-primary" : "text-text hover:bg-background"
                  }`}
                >
                  <span className="truncate">{item.breadcrumb}</span>
                  {index === activeIndex && <CornerDownLeft className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
