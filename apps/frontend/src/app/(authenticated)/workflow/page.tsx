"use client";

/**
 * @file src/app/(authenticated)/workflow/page.tsx
 * @description 워크플로우 페이지 — 7개 업무 프로세스 흐름을 대시보드 그리드로 표시
 *
 * 초보자 가이드:
 * 1. workflowConfigs에서 7개 워크플로우 정의를 로드
 * 2. GET /workflow/summary API로 노드별 건수 조회
 * 3. WorkflowCard 컴포넌트로 각 워크플로우를 2열 그리드에 배치
 * 4. 새로고침 버튼으로 데이터 갱신
 */
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { workflowConfigs } from "@/config/workflowConfig";
import WorkflowCard from "./components/WorkflowCard";
import api from "@/services/api";

interface NodeCounts {
  pendingCnt: number;
  activeCnt: number;
  doneCnt: number;
  reverseCnt: number;
}

type SummaryData = Record<string, Record<string, NodeCounts>>;

export default function WorkflowPage() {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<SummaryData>({});
  const [loading, setLoading] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/workflow/summary");
      setSummary(res.data?.data ?? {});
    } catch (error: unknown) {
      console.error("Workflow summary fetch failed:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return (
    <div className="h-full flex flex-col overflow-hidden p-6 gap-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text flex items-center gap-2">
            <GitBranch className="w-6 h-6 text-primary" />
            {t("workflow.title")}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {t("workflow.subtitle")}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={fetchSummary}
          disabled={loading}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {t("workflow.refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {workflowConfigs.map((wf) => (
          <div key={wf.id} className={wf.fullWidth ? "lg:col-span-2" : ""}>
            <WorkflowCard
              workflow={wf}
              counts={summary[wf.id] ?? {}}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
