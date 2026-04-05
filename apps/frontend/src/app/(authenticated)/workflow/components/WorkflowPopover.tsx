"use client";

/**
 * @file WorkflowPopover.tsx
 * @description 워크플로우 노드 클릭 시 팝오버 — 현황 통계 + 바로가기/역분개 버튼
 *
 * 초보자 가이드:
 * 1. 노드 클릭 시 오버레이 + 팝오버 표시
 * 2. 현황 통계 4칸 (대기/진행/완료/취소대기) — 단색 통일
 * 3. 바로가기 버튼 + 역분개 버튼(있는 경우만)
 * 4. 넉넉한 사이즈로 답답하지 않게
 */
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import type { WorkflowNode } from "@/config/workflowConfig";

interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

interface WorkflowPopoverProps {
  node: WorkflowNode;
  counts: NodeCounts;
  onClose: () => void;
}

export default function WorkflowPopover({ node, counts, onClose }: WorkflowPopoverProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const stats = [
    { value: counts.pendingCnt, labelKey: "workflow.popover.pendingCnt" },
    { value: counts.activeCnt, labelKey: "workflow.popover.activeCnt" },
    { value: counts.doneCnt, labelKey: "workflow.popover.doneCnt" },
    { value: counts.reverseCnt, labelKey: "workflow.popover.reverseCnt" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl w-[480px]
          border border-pink-200 dark:border-pink-800/40
          shadow-2xl dark:shadow-black/50 overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-6 py-4
          bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
          <span className="w-2 h-2 rounded-full bg-pink-400" />
          <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100">
            {t(node.labelKey)}
          </h3>
        </div>

        <div className="p-6 space-y-5">
          {/* 통계 — 단색 통일 */}
          <div className="grid grid-cols-4 gap-3">
            {stats.map((s) => (
              <div key={s.labelKey} className="rounded-lg p-3 text-center
                bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/50">
                <div className="text-2xl font-black tabular-nums text-zinc-800 dark:text-zinc-100">
                  {s.value}
                </div>
                <div className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 mt-1">
                  {t(s.labelKey)}
                </div>
              </div>
            ))}
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-sm font-bold
                bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400
                hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              {t("workflow.action.close")}
            </button>
            {node.reversePath && (
              <button
                type="button"
                onClick={() => { onClose(); router.push(node.reversePath!); }}
                className="px-5 py-2.5 rounded-lg text-sm font-bold
                  border border-zinc-300 dark:border-zinc-600
                  text-zinc-600 dark:text-zinc-300
                  hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                ↩ {t(node.reverseKey!)}
              </button>
            )}
            <button
              type="button"
              onClick={() => { onClose(); router.push(node.path); }}
              className="flex-1 px-5 py-2.5 rounded-lg text-sm font-black
                bg-pink-500 text-white
                hover:bg-pink-600 transition-colors"
            >
              {t("workflow.action.goTo")} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
