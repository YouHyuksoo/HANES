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

import HelpTooltip from "@/components/shared/HelpTooltip";
import { useMemo, type ReactNode } from "react";
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
  filters?: ReactNode;
  footer?: ReactNode;
  serverFiltered?: boolean;
  searchPlaceholder?: string;
}

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

  const filtered = useMemo(() => {
    if (serverFiltered || !searchText) return parts;
    const s = searchText.toLowerCase();
    return parts.filter(
      (p) =>
        p.itemCode.toLowerCase().includes(s) ||
        p.itemName.toLowerCase().includes(s)
    );
  }, [parts, searchText, serverFiltered]);

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
        <HelpTooltip description={`품목코드 또는 품목명 일부를 입력하면 해당 원자재를 찾습니다.${filters ? " 사용여부와 검사항목 유무 조건이 함께 적용되므로 결과가 없으면 필터도 확인하세요." : ""}`} className="w-full">
        <Input
          placeholder={searchPlaceholder ?? t("master.iqcItem.searchPlaceholder", "품목코드, 검사항목 검색...")}
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
                <HelpTooltip key={part.itemCode} description={`${part.itemCode} · ${part.itemName}\n배정된 검사항목 ${linkCount}개입니다. 클릭하면 이 품목의 기준을 오른쪽에서 조회·편집합니다. ${linkCount === 0 ? "항목 추가 또는 템플릿 불러오기로 기준을 작성한 뒤 저장하세요." : "숫자는 검사 수량이 아닌 배정 항목 수입니다."}`} className="w-full">
                <button
                  type="button"
                  onClick={() => onSelect(part.itemCode)}
                  className={`w-full text-left px-4 py-2 transition-colors ${
                    isSelected
                      ? "bg-primary text-white"
                      : "hover:bg-surface dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1 flex items-baseline gap-2">
                      <span
                        className={`text-xs font-mono flex-shrink-0 ${
                          isSelected ? "text-white/80" : "text-text-muted"
                        }`}
                      >
                        {part.itemCode}
                      </span>
                      <span
                        className={`text-sm font-medium truncate ${
                          isSelected ? "text-white" : "text-text"
                        }`}
                      >
                        {part.itemName}
                      </span>
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
