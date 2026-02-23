"use client";

/**
 * @file src/components/pda/ScanHistoryList.tsx
 * @description 스캔 이력 리스트 - 최신순 정렬, 접기/펴기
 *
 * 초보자 가이드:
 * 1. **items**: 스캔 이력 배열 (제네릭)
 * 2. **renderItem**: 각 이력 항목 렌더 함수
 * 3. 최신 항목이 상단에 위치, 접기/펴기 토글
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, History } from "lucide-react";

interface ScanHistoryListProps<T> {
  /** 이력 데이터 배열 */
  items: T[];
  /** 각 항목 렌더 함수 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 항목 고유 키 */
  keyExtractor: (item: T, index: number) => string;
  /** 최대 표시 개수 (기본 10) */
  maxDisplay?: number;
  /** 타이틀 i18n 키 (기본: pda.scan.history) */
  titleKey?: string;
}

export default function ScanHistoryList<T>({
  items,
  renderItem,
  keyExtractor,
  maxDisplay = 10,
  titleKey = "pda.scan.history",
}: ScanHistoryListProps<T>) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  const displayItems = items.slice(0, maxDisplay);

  return (
    <div className="mx-4 mt-3">
      {/* 헤더 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t(titleKey)}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ({items.length})
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* 리스트 */}
      {expanded && (
        <div className="space-y-2 pb-4">
          {displayItems.map((item, idx) => (
            <div
              key={keyExtractor(item, idx)}
              className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
            >
              {renderItem(item, idx)}
            </div>
          ))}
          {items.length > maxDisplay && (
            <p className="text-xs text-center text-slate-400 py-1">
              +{items.length - maxDisplay} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
