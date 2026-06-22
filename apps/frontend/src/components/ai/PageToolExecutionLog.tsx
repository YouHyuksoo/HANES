"use client";

import { ClipboardList } from "lucide-react";
import { usePageToolStore } from "@/ai-page-tools/pageToolStore";

const statusClass: Record<string, string> = {
  success: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
  blocked: "text-amber-600 dark:text-amber-400",
};

export default function PageToolExecutionLog() {
  const logs = usePageToolStore((state) => state.executionLogs);

  if (logs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-text-muted">
        <ClipboardList className="h-10 w-10 opacity-25" />
        <p className="text-sm">아직 실행된 페이지 도구가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {logs.map((log) => (
        <div key={log.id} className="rounded-md border border-border bg-surface p-3 text-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono font-semibold text-text">{log.toolName}</div>
              <div className="mt-0.5 text-text-muted">{log.pageId}</div>
            </div>
            <span className={`shrink-0 font-semibold ${statusClass[log.status] ?? "text-text-muted"}`}>
              {log.status}
            </span>
          </div>
          <p className="mt-2 text-text">{log.summary}</p>
          <details className="mt-2 text-text-muted">
            <summary className="cursor-pointer select-none">입력값</summary>
            <pre className="mt-1 max-h-32 overflow-auto rounded border border-border bg-background px-2 py-1 font-mono text-[11px]">
              {JSON.stringify(log.input, null, 2)}
            </pre>
          </details>
          <div className="mt-2 text-[11px] text-text-muted">{new Date(log.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}
