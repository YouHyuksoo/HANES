"use client";

/**
 * @file WorkflowNode.tsx
 * @description 워크플로우 노드 — 헤더(단계명) + 본문(상태/건수) 2단 구조
 *
 * 초보자 가이드:
 * 1. 헤더: 배경색 + 단계명
 * 2. 본문: 상태 라벨 + 건수
 * 3. 호버 시 핑크 강조 + 살짝 떠오름
 */
import { useTranslation } from "react-i18next";

export interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

interface WorkflowNodeProps {
  labelKey: string;
  statusKey: string;
  accentBar: string;
  counts?: NodeCounts;
  onClick?: () => void;
}

export default function WorkflowNode({
  labelKey, statusKey, accentBar, counts, onClick,
}: WorkflowNodeProps) {
  const { t } = useTranslation();
  const total = counts
    ? counts.pendingCnt + counts.activeCnt + counts.doneCnt
    : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 min-w-0 rounded-md overflow-hidden
        border border-pink-300 dark:border-pink-800/50
        hover:border-pink-500 dark:hover:border-pink-500
        hover:shadow-md hover:-translate-y-0.5
        active:scale-[0.97] active:shadow-sm
        transition-all duration-150 cursor-pointer text-left group"
    >
      <div className="px-2.5 py-1 bg-pink-50 dark:bg-pink-950/30
        group-hover:bg-pink-100 dark:group-hover:bg-pink-900/40
        border-b border-pink-200 dark:border-pink-800/40 transition-colors">
        <div className="text-[11px] font-bold text-pink-700 dark:text-pink-300 truncate
          group-hover:text-pink-800 dark:group-hover:text-pink-200 transition-colors">
          {t(labelKey)}
        </div>
      </div>
      <div className="px-2.5 py-1.5 bg-white dark:bg-zinc-900/60 flex items-center gap-1
        group-hover:bg-pink-50/50 dark:group-hover:bg-pink-950/20 transition-colors">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
          {t(statusKey)}
        </span>
        {total > 0 && (
          <span className="text-[11px] font-black text-zinc-900 dark:text-zinc-100 tabular-nums ml-auto shrink-0">
            {total}
          </span>
        )}
      </div>
    </button>
  );
}
