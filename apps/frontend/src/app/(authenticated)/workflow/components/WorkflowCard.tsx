"use client";

/**
 * @file WorkflowCard.tsx
 * @description 워크플로우 카드 — 하나의 업무 프로세스 흐름을 표시하는 카드
 *
 * 초보자 가이드:
 * 1. 카드 헤더: 아이콘 + 제목 + 배지 + 크게보기 버튼
 * 2. 카드 본문: WorkflowNode들을 수평으로 배치, 화살표로 연결
 * 3. 분기가 있는 위치에 WorkflowBranch 배지 삽입
 * 4. 노드 클릭 시 WorkflowPopover 표시
 * 5. 크게보기: 카드가 중앙으로 확대 애니메이션되며 오버레이 표시
 */
import { useState, useCallback, Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, X } from "lucide-react";
import type { WorkflowDefinition, WorkflowNode as NodeDef } from "@/config/workflowConfig";
import WorkflowNode from "./WorkflowNode";
import WorkflowBranch from "./WorkflowBranch";
import WorkflowPopover from "./WorkflowPopover";

interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

interface WorkflowCardProps {
  workflow: WorkflowDefinition;
  counts: Record<string, NodeCounts>;
}

const EMPTY_COUNTS: NodeCounts = { pendingCnt: 0, activeCnt: 0, doneCnt: 0, reverseCnt: 0 };

/** 카드 내부 플로우 렌더 (일반/확대 공용) */
function FlowContent({
  workflow, counts, branchMap, onNodeClick, expanded,
}: {
  workflow: WorkflowDefinition;
  counts: Record<string, NodeCounts>;
  branchMap: Map<string, NonNullable<WorkflowDefinition["branches"]>[number]>;
  onNodeClick: (node: NodeDef) => void;
  expanded?: boolean;
}) {
  return (
    <div className={`flex items-stretch gap-0.5 min-h-0 overflow-x-auto ${expanded ? "px-8 py-10" : "p-3"}`}>
      {workflow.nodes.map((node, idx) => (
        <Fragment key={node.id}>
          {idx > 0 && !branchMap.has(workflow.nodes[idx - 1].id) && (
            <div className="flex items-center shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" className="overflow-visible">
                <defs>
                  <linearGradient id={`wf-grad-${workflow.id}-${idx}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(244,114,182)" stopOpacity="0.2">
                      <animate attributeName="stop-opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="50%" stopColor="rgb(244,114,182)" stopOpacity="0.8">
                      <animate attributeName="stop-opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="100%" stopColor="rgb(244,114,182)" stopOpacity="0.2">
                      <animate attributeName="stop-opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
                    </stop>
                  </linearGradient>
                </defs>
                <line x1="0" y1="8" x2="12" y2="8" stroke={`url(#wf-grad-${workflow.id}-${idx})`} strokeWidth="2" strokeLinecap="round" />
                <path d="M10 5l3 3-3 3" stroke="rgb(244,114,182)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
              </svg>
            </div>
          )}
          {idx > 0 && branchMap.has(workflow.nodes[idx - 1].id) && (
            <WorkflowBranch branch={branchMap.get(workflow.nodes[idx - 1].id)!} />
          )}
          <WorkflowNode
            labelKey={node.labelKey}
            statusKey={node.statusKey}
            accentBar={workflow.badgeColor}
            counts={counts[node.id] ?? EMPTY_COUNTS}
            onClick={() => onNodeClick(node)}
          />
        </Fragment>
      ))}
    </div>
  );
}

export default function WorkflowCard({ workflow, counts }: WorkflowCardProps) {
  const { t } = useTranslation();
  const [selectedNode, setSelectedNode] = useState<NodeDef | null>(null);
  const [expanded, setExpanded] = useState(false);

  const totalActive = Object.values(counts).reduce(
    (sum, c) => sum + c.pendingCnt + c.activeCnt, 0,
  );

  const handleNodeClick = useCallback((node: NodeDef) => {
    setSelectedNode(node);
  }, []);

  const branchMap = new Map(
    (workflow.branches ?? []).map((b) => [b.afterNodeId, b]),
  );

  return (
    <>
      {/* 일반 카드 */}
      <div
        className="relative overflow-hidden rounded-xl
          border border-pink-200 dark:border-pink-800/40
          bg-white dark:bg-zinc-900/60 dark:backdrop-blur-sm
          shadow-sm hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center justify-between px-4 py-2.5
          border-b border-zinc-100 dark:border-zinc-700/50
          bg-zinc-50 dark:bg-zinc-800/80"
        >
          <div className="flex items-center gap-2.5">
            <workflow.icon className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="text-sm font-black text-zinc-800 dark:text-zinc-100 tracking-tight">
              {t(workflow.titleKey)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {totalActive > 0 && (
              <span className="bg-zinc-700 dark:bg-zinc-200 text-white dark:text-zinc-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                {totalActive}{t("workflow.activeSuffix")}
              </span>
            )}
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="p-1 rounded-md text-zinc-400 dark:text-zinc-500
                hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20
                transition-colors"
              title="크게보기"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <FlowContent
          workflow={workflow}
          counts={counts}
          branchMap={branchMap}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* 확대 오버레이 */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm
            animate-fade-in"
          onClick={() => setExpanded(false)}
        >
          <div
            className="w-[95vw] max-w-6xl rounded-2xl overflow-hidden
              border border-pink-300 dark:border-pink-700
              bg-white dark:bg-zinc-900 shadow-2xl
              animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 확대 헤더 */}
            <div className="flex items-center justify-between px-6 py-3
              border-b border-zinc-100 dark:border-zinc-700/50
              bg-zinc-50 dark:bg-zinc-800/80"
            >
              <div className="flex items-center gap-3">
                <workflow.icon className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
                <span className="text-base font-black text-zinc-800 dark:text-zinc-100">
                  {t(workflow.titleKey)}
                </span>
                {totalActive > 0 && (
                  <span className="bg-zinc-700 dark:bg-zinc-200 text-white dark:text-zinc-800 text-[10px] font-bold px-2.5 py-1 rounded-full">
                    {totalActive}{t("workflow.activeSuffix")}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg text-zinc-400
                  hover:text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20
                  transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 확대 플로우 */}
            <FlowContent
              workflow={workflow}
              counts={counts}
              branchMap={branchMap}
              onNodeClick={handleNodeClick}
              expanded
            />
          </div>
        </div>
      )}

      {/* 팝오버 */}
      {selectedNode && (
        <WorkflowPopover
          node={selectedNode}
          counts={counts[selectedNode.id] ?? EMPTY_COUNTS}
          onClose={() => setSelectedNode(null)}
        />
      )}

    </>
  );
}
