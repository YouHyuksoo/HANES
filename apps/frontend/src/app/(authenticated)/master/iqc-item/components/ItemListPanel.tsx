"use client";

/**
 * @file components/ItemListPanel.tsx
 * @description IQC 품목별 검사 — 좌측 품목그룹(폴더) → 품목 목록
 */
import HelpTooltip from "@/components/shared/HelpTooltip";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Search, Package, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { Card, CardHeader, CardContent, Input } from "@/components/ui";

interface PartItem {
  itemCode: string;
  itemName: string;
  productType?: string | null;
}

interface ItemListPanelProps {
  parts: PartItem[];
  linkCountMap: Map<string, number>;
  selectedItemCode: string | null;
  onSelect: (itemCode: string) => void;
  searchText: string;
  onSearchChange: (value: string) => void;
  loading: boolean;
  filters?: ReactNode;
  footer?: ReactNode;
  serverFiltered?: boolean;
  searchPlaceholder?: string;
}

const UNGROUPED = "__UNGROUPED__";

export default function ItemListPanel({
  parts,
  linkCountMap,
  selectedItemCode,
  onSelect,
  searchText,
  onSearchChange,
  loading,
  filters,
  footer,
  serverFiltered = false,
  searchPlaceholder,
}: ItemListPanelProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    if (serverFiltered || !searchText) return parts;
    const s = searchText.toLowerCase();
    return parts.filter(
      (p) =>
        p.itemCode.toLowerCase().includes(s) ||
        p.itemName.toLowerCase().includes(s) ||
        (p.productType ?? "").toLowerCase().includes(s),
    );
  }, [parts, searchText, serverFiltered]);

  const groups = useMemo(() => {
    const map = new Map<string, PartItem[]>();
    for (const part of filtered) {
      const key = (part.productType ?? "").trim() || UNGROUPED;
      const list = map.get(key) ?? [];
      list.push(part);
      map.set(key, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => {
        if (a === UNGROUPED) return 1;
        if (b === UNGROUPED) return -1;
        return a.localeCompare(b, "ko");
      })
      .map(([key, items]) => ({
        key,
        label: key === UNGROUPED ? t("master.iqcPartSpec.ungrouped", "미지정") : key,
        items,
      }));
  }, [filtered, t]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        if (g.items.some((p) => p.itemCode === selectedItemCode) || searchText.trim()) {
          next.add(g.key);
        }
        if (prev.size === 0) next.add(g.key);
      }
      return next;
    });
  }, [groups, selectedItemCode, searchText]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card padding="none" className="flex flex-col h-full">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {t("master.iqcItem.materialList", "자재 품목 목록")}
          </span>
        }
        className="px-4 pt-4 pb-2 mb-0"
      />
      <div className="px-4 pb-3">
        {filters}
        <HelpTooltip description={`품목그룹·품목코드·품목명으로 찾습니다. 그룹을 접고 펼쳐 품목을 고르세요.`} className="w-full">
        <Input
          placeholder={searchPlaceholder ?? t("master.iqcItem.searchPlaceholder", "품목그룹, 품목코드 검색...")}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
        </HelpTooltip>
      </div>
      <CardContent className="flex-1 min-h-0 overflow-y-auto px-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-muted">
            {t("common.loading", "로딩 중...")}
          </div>
        ) : groups.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-text-muted text-sm">
            {t("common.noData", "데이터가 없습니다.")}
          </div>
        ) : (
          <div>
            {groups.map((group) => {
              const open = expanded.has(group.key);
              const groupCount = group.items.reduce((n, p) => n + (linkCountMap.get(p.itemCode) ?? 0), 0);
              return (
                <div key={group.key} className="border-b border-border">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-surface dark:hover:bg-slate-800"
                  >
                    <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 text-text-muted transition-transform ${open ? "rotate-90" : ""}`} />
                    {open
                      ? <FolderOpen className="w-4 h-4 flex-shrink-0 text-primary" />
                      : <Folder className="w-4 h-4 flex-shrink-0 text-primary" />}
                    <span className="text-sm font-semibold text-text truncate flex-1">{group.label}</span>
                    <span className="text-[10px] text-text-muted flex-shrink-0">{group.items.length}</span>
                    {groupCount > 0 && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 text-[10px] rounded-full font-medium bg-primary/10 text-primary">
                        {groupCount}
                      </span>
                    )}
                  </button>
                  {open && group.items.map((part) => {
                    const isSelected = selectedItemCode === part.itemCode;
                    const linkCount = linkCountMap.get(part.itemCode) ?? 0;
                    return (
                      <HelpTooltip
                        key={part.itemCode}
                        description={`${part.itemCode} · ${part.itemName}\n배정된 검사항목 ${linkCount}개입니다.`}
                        className="w-full"
                      >
                        <button
                          type="button"
                          onClick={() => onSelect(part.itemCode)}
                          className={`w-full text-left pl-8 pr-4 py-1.5 transition-colors ${
                            isSelected
                              ? "bg-primary text-white"
                              : "hover:bg-surface dark:hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className={`text-xs font-mono truncate ${isSelected ? "text-white/90" : "text-text"}`}>
                                {part.itemCode}
                              </div>
                              {part.itemName !== group.label && (
                                <div className={`text-[10px] truncate ${isSelected ? "text-white/70" : "text-text-muted"}`}>
                                  {part.itemName}
                                </div>
                              )}
                            </div>
                            {linkCount > 0 && (
                              <span
                                className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${
                                  isSelected
                                    ? "bg-white/20 text-white"
                                    : "bg-primary/10 text-primary dark:bg-primary/20"
                                }`}
                              >
                                {linkCount}
                              </span>
                            )}
                          </div>
                        </button>
                      </HelpTooltip>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <div className="px-4 py-2 border-t border-border text-xs text-text-muted text-right">
        {footer ?? <>
        {t("common.total", "합계")}: {filtered.length}
        {t("common.件", "건")}
        </>}
      </div>
    </Card>
  );
}
