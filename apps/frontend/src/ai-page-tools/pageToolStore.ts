"use client";

import { create } from "zustand";
import {
  AiPageToolExecutionLog,
  AiPageToolManifest,
  AiPageToolTab,
  FrontendToolExecutor,
} from "./types";

interface PageToolState {
  activePageId: string | null;
  manifest: AiPageToolManifest | null;
  activeTab: AiPageToolTab;
  executionLogs: AiPageToolExecutionLog[];
  frontendExecutors: Record<string, Record<string, FrontendToolExecutor>>;
  setActivePage: (pageId: string | null, manifest: AiPageToolManifest | null) => void;
  openToolsTab: () => void;
  openChatTab: () => void;
  openLogTab: () => void;
  addExecutionLog: (log: Omit<AiPageToolExecutionLog, "id" | "createdAt">) => void;
  setFrontendExecutors: (pageId: string, executors: Record<string, FrontendToolExecutor>) => void;
  executeFrontendTool: (pageId: string, toolName: string, input: unknown) => Promise<unknown>;
}

const nextLogId = () => `tool-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const usePageToolStore = create<PageToolState>((set, get) => ({
  activePageId: null,
  manifest: null,
  activeTab: "chat",
  executionLogs: [],
  frontendExecutors: {},
  setActivePage: (pageId, manifest) => set({ activePageId: pageId, manifest }),
  openToolsTab: () => set({ activeTab: "tools" }),
  openChatTab: () => set({ activeTab: "chat" }),
  openLogTab: () => set({ activeTab: "log" }),
  addExecutionLog: (log) =>
    set((state) => ({
      executionLogs: [
        {
          ...log,
          id: nextLogId(),
          createdAt: new Date().toISOString(),
        },
        ...state.executionLogs,
      ].slice(0, 50),
    })),
  setFrontendExecutors: (pageId, executors) =>
    set((state) => ({
      frontendExecutors: {
        ...state.frontendExecutors,
        [pageId]: executors,
      },
    })),
  executeFrontendTool: async (pageId, toolName, input) => {
    const executor = get().frontendExecutors[pageId]?.[toolName];
    if (!executor) {
      throw new Error(`등록되지 않은 프론트엔드 도구입니다: ${pageId}.${toolName}`);
    }
    return executor(input);
  },
}));
