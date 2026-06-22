"use client";

import { useCallback, useEffect } from "react";
import api from "@/services/api";
import { FrontendToolExecutor } from "./types";
import { usePageToolStore } from "./pageToolStore";

/** 안정적 기본값 — 인자 미전달 시 매 렌더 새 객체가 생겨 useEffect 무한루프 나는 것 방지 */
const EMPTY_EXECUTORS: Record<string, FrontendToolExecutor> = {};

export function usePageAiTools(
  pageId: string,
  frontendExecutors: Record<string, FrontendToolExecutor> = EMPTY_EXECUTORS,
) {
  const manifest = usePageToolStore((state) => state.manifest);
  const setActivePage = usePageToolStore((state) => state.setActivePage);
  const setFrontendExecutors = usePageToolStore((state) => state.setFrontendExecutors);
  const executeFrontendTool = usePageToolStore((state) => state.executeFrontendTool);
  const addExecutionLog = usePageToolStore((state) => state.addExecutionLog);

  useEffect(() => {
    let cancelled = false;

    const loadManifest = async () => {
      const res = await api.get(`/ai/page-tools/${pageId}`, { suppressErrorModal: true });
      if (cancelled) return;
      setActivePage(pageId, res.data?.data ?? res.data);
    };

    setFrontendExecutors(pageId, frontendExecutors);
    void loadManifest().catch((error: unknown) => {
      if (cancelled) return;
      addExecutionLog({
        pageId,
        toolName: "loadManifest",
        input: { pageId },
        status: "failed",
        summary: error instanceof Error ? error.message : "페이지 도구 매니페스트를 불러오지 못했습니다.",
      });
    });

    return () => {
      cancelled = true;
      setActivePage(null, null);
    };
  }, [addExecutionLog, frontendExecutors, pageId, setActivePage, setFrontendExecutors]);

  const runFrontendTool = useCallback(
    (toolName: string, input: unknown) => executeFrontendTool(pageId, toolName, input),
    [executeFrontendTool, pageId],
  );

  const runBackendTool = useCallback(
    async (toolName: string, input: unknown) => {
      const res = await api.post(`/ai/page-tools/${pageId}/execute`, { toolName, input }, { suppressErrorModal: true });
      return res.data?.data ?? res.data;
    },
    [pageId],
  );

  return {
    manifest: manifest?.pageId === pageId ? manifest : null,
    executeFrontendTool: runFrontendTool,
    executeBackendTool: runBackendTool,
  };
}
