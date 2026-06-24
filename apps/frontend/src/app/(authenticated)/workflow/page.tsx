"use client";

/**
 * @file src/app/(authenticated)/workflow/page.tsx
 * @description 처음 사용자를 위한 업무 가이드 허브 — 좌측 단계 목록 + 중앙 가이드 + 흐름도 탭
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, LayoutList, Search, Workflow } from "lucide-react";
import { workflowNodes, type WorkflowActivityNode } from "@/config/workflowMap";
import WorkflowSidebar from "./components/WorkflowSidebar";
import WorkflowGuide from "./components/WorkflowGuide";
import WorkflowFlow from "./components/WorkflowFlow";

type WorkflowTab = "guide" | "flow";

const nodeById = new Map(workflowNodes.map((n) => [n.id, n]));

export default function WorkflowPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<WorkflowTab>("guide");
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState(workflowNodes[0]?.id ?? "");

  const selectedNode: WorkflowActivityNode | undefined = nodeById.get(selectedNodeId) ?? workflowNodes[0];

  const selectFromFlow = (id: string) => {
    setSelectedNodeId(id);
    setTab("guide");
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-text">
      {/* 헤더 */}
      <header className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">{t("workflowGuide.pageTitle", "업무 가이드")}</h1>
              <p className="truncate text-xs text-text-muted">
                {t("workflowGuide.pageSubtitle", "처음 사용자를 위한 단계별 업무 지침과 화면 바로가기를 제공합니다.")}
              </p>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <TabButton active={tab === "guide"} onClick={() => setTab("guide")} icon={<LayoutList className="h-3.5 w-3.5" />}>
              {t("workflowGuide.tabGuide", "가이드")}
            </TabButton>
            <TabButton active={tab === "flow"} onClick={() => setTab("flow")} icon={<Workflow className="h-3.5 w-3.5" />}>
              {t("workflowGuide.tabFlow", "흐름도")}
            </TabButton>
          </div>
        </div>
        <div className="mt-3">
          <label className="relative block w-[360px] max-w-[44vw]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("workflowGuide.searchPlaceholder", "업무, 화면, 데이터 객체 검색")}
              className="h-9 w-full rounded border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </header>

      {/* 본문 */}
      {tab === "guide" ? (
        <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(0,1fr)] overflow-hidden">
          <WorkflowSidebar query={query} selectedNodeId={selectedNodeId} onSelect={setSelectedNodeId} />
          <main className="min-h-0 overflow-y-auto" data-workflow-detail-panel="true">
            {selectedNode ? (
              <WorkflowGuide node={selectedNode} onSelect={setSelectedNodeId} />
            ) : (
              <div className="p-5 text-sm text-text-muted">업무 단계를 선택하세요.</div>
            )}
          </main>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <WorkflowFlow selectedNodeId={selectedNodeId} onSelect={selectFromFlow} query={query} />
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-semibold transition-colors ${
        active ? "bg-primary text-white" : "text-text-muted hover:bg-muted"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}
