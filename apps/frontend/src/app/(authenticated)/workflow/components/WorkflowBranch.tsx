"use client";

/**
 * @file WorkflowBranch.tsx
 * @description 워크플로우 분기 표시 — 합격/불합격 등 분기 배지
 *
 * 초보자 가이드:
 * 1. 노드 사이에 위치하여 분기 조건을 시각적으로 표시
 * 2. pass는 녹색, fail은 빨간색 배지
 */
import { useTranslation } from "react-i18next";
import type { WorkflowBranch as BranchDef } from "@/config/workflowConfig";

interface WorkflowBranchProps {
  branch: BranchDef;
}

export default function WorkflowBranch({ branch }: WorkflowBranchProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-0.5 shrink-0">
      {branch.conditions.map((cond) => (
        <div key={cond.type} className="flex items-center gap-0.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
              cond.type === "pass"
                ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"
            }`}
          >
            {cond.type === "pass" ? "✓" : "✗"} {t(cond.labelKey)}
          </span>
        </div>
      ))}
    </div>
  );
}
