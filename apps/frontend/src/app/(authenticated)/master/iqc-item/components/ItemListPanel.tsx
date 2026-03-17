"use client";

/**
 * @file components/ItemListPanel.tsx
 * @description IQC 품목별 검사 — 좌측 자재 품목 목록 패널
 *
 * 초보자 가이드:
 * 1. RAW_MATERIAL 타입의 품목을 조회하여 리스트로 표시
 * 2. 검색(품목코드/품목명) 필터링 지원
 * 3. 각 품목별 연결된 검사그룹 수를 배지로 표시
 * 4. 클릭 시 선택된 품목을 부모에게 전달 → 우측 패널에서 상세 표시
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Search, Package } from "lucide-react";
import { Card, CardHeader, CardContent, Input } from "@/components/ui";

interface PartItem {
  itemCode: string;
  itemName: string;
}

interface ItemListPanelProps {
  /** 자재 품목 목록 */
  parts: PartItem[];
  /** 품목코드 → 연결된 그룹 수 맵 */
  linkCountMap: Map<string, number>;
  /** 현재 선택된 품목코드 */
  selectedItemCode: string | null;
  /** 품목 선택 콜백 */
  onSelect: (itemCode: string) => void;
  /** 검색어 */
  searchText: string;
  /** 검색어 변경 콜백 */
  onSearchChange: (value: string) => void;
  /** 로딩 상태 */
  loading: boolean;
}

export default function ItemListPanel({
  parts,
  linkCountMap,
  selectedItemCode,
  onSelect,
  searchText,
  onSearchChange,
  loading,
}: ItemListPanelProps) {
  const { t } = useTranslation();

  const filtered = useMemo(() => {
    if (!searchText) return parts;
    const s = searchText.toLowerCase();
    return parts.filter(
      (p) =>
        p.itemCode.toLowerCase().includes(s) ||
        p.itemName.toLowerCase().includes(s)
    );
  }, [parts, searchText]);

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
        <Input
          placeholder={t("master.iqcItem.searchPlaceholder", "품목코드, 검사항목 검색...")}
          value={searchText}
          onChange={(e) => onSearchChange(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
          fullWidth
        />
      </div>
      <CardContent className="flex-1 min-h-0 overflow-y-auto px-0">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-text-muted">
            {t("common.loading", "로딩 중...")}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-text-muted text-sm">
            {t("common.noData", "데이터가 없습니다.")}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((part) => {
              const isSelected = selectedItemCode === part.itemCode;
              const linkCount = linkCountMap.get(part.itemCode) ?? 0;
              return (
                <button
                  key={part.itemCode}
                  type="button"
                  onClick={() => onSelect(part.itemCode)}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : "hover:bg-surface dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-mono ${
                          isSelected ? "text-white/80" : "text-text-muted"
                        }`}
                      >
                        {part.itemCode}
                      </p>
                      <p
                        className={`text-sm font-medium truncate ${
                          isSelected ? "text-white" : "text-text"
                        }`}
                      >
                        {part.itemName}
                      </p>
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
              );
            })}
          </div>
        )}
      </CardContent>
      <div className="px-4 py-2 border-t border-border text-xs text-text-muted text-right">
        {t("common.total", "합계")}: {filtered.length}
        {t("common.件", "건")}
      </div>
    </Card>
  );
}
