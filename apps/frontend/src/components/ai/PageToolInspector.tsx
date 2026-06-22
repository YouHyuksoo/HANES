"use client";

import { Braces, ShieldCheck, Wrench } from "lucide-react";
import { usePageToolStore } from "@/ai-page-tools/pageToolStore";
import type { AiPageToolDefinition } from "@/ai-page-tools/types";

const riskLabel: Record<string, string> = {
  read: "조회",
  draft: "초안",
  propose: "제안",
  write: "쓰기",
};

function SchemaPreview({ value }: { value?: Record<string, unknown> }) {
  if (!value || Object.keys(value).length === 0) {
    return <span className="text-text-muted">없음</span>;
  }
  return (
    <pre className="max-h-24 overflow-auto rounded border border-border bg-background px-2 py-1 text-[11px] leading-relaxed text-text-muted">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ToolRow({ tool }: { tool: AiPageToolDefinition }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-primary" />
            <span className="font-semibold text-text">{tool.label}</span>
            <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              {tool.name}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{tool.description}</p>
        </div>
        <span className="shrink-0 rounded bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
          {riskLabel[tool.riskLevel] ?? tool.riskLevel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="mb-1 text-[11px] font-semibold text-text-muted">source</div>
          <div className="text-text">{tool.source}</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold text-text-muted">confirmationPolicy</div>
          <div className="text-text">{tool.confirmationPolicy ?? (tool.requiresConfirmation ? "required" : "none")}</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold text-text-muted">neverPersists</div>
          <div className="text-text">{tool.neverPersists ? "Y" : "N"}</div>
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold text-text-muted">riskLevel</div>
          <div className="text-text">{tool.riskLevel}</div>
        </div>
        <div className="col-span-2">
          <div className="mb-1 text-[11px] font-semibold text-text-muted">inputSchema</div>
          <SchemaPreview value={tool.inputSchema} />
        </div>
      </div>
    </div>
  );
}

export default function PageToolInspector() {
  const manifest = usePageToolStore((state) => state.manifest);

  if (!manifest) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-text-muted">
        <Braces className="h-10 w-10 opacity-25" />
        <p className="text-sm">현재 페이지에 등록된 AI 도구가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="rounded-md border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-sm font-bold text-text">
          <ShieldCheck className="h-4 w-4 text-primary" />
          {manifest.title}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-text-muted">
          <div>pageId: <span className="font-mono text-text">{manifest.pageId}</span></div>
          <div>route: <span className="font-mono text-text">{manifest.route}</span></div>
          <div className="col-span-2">
            executionLevel: <span className="font-mono text-text">{manifest.executionLevel}</span>
          </div>
        </div>
      </div>

      {manifest.tools.map((tool) => (
        <ToolRow key={tool.name} tool={tool} />
      ))}
    </div>
  );
}
