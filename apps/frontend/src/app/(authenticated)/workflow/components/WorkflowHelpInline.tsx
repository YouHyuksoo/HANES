"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";
import { findMenuCodeByPath } from "@/config/menuConfig";
import { useHelpDoc } from "@/hooks/useHelpDoc";
import MarkdownRenderer from "@/components/help/MarkdownRenderer";
import type { WorkflowActivityNode } from "@/config/workflowMap";

type HelpAudience = "user" | "operator";

interface HelpRef {
  key: string;
  label: string;
  menuCode: string;
  audience: HelpAudience;
}

/** node.helpRefs 우선, 없으면 routes에서 메뉴코드 자동 도출 */
function deriveHelpRefs(node: WorkflowActivityNode): HelpRef[] {
  if (node.helpRefs && node.helpRefs.length > 0) {
    return node.helpRefs.map((ref) => ({
      key: `${ref.menuCode}:${ref.audience}`,
      label: ref.menuCode,
      menuCode: ref.menuCode,
      audience: ref.audience,
    }));
  }
  const seen = new Set<string>();
  const refs: HelpRef[] = [];
  for (const route of node.routes) {
    const code = findMenuCodeByPath(route.path);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    refs.push({ key: code, label: route.label, menuCode: code, audience: "user" });
  }
  return refs;
}

function HelpItem({ refItem }: { refItem: HelpRef }) {
  const [open, setOpen] = useState(false);
  const { content, loading, notFound } = useHelpDoc(refItem.menuCode, refItem.audience);

  // 도움말이 없으면 항목 자체를 숨김
  if (notFound && !loading) return null;

  return (
    <div className="rounded border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-text hover:bg-muted"
      >
        {open ? <ChevronDown className="h-4 w-4 text-text-muted" /> : <ChevronRight className="h-4 w-4 text-text-muted" />}
        <BookOpen className="h-4 w-4 text-primary" />
        <span className="flex-1 truncate">{refItem.label}</span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2">
          {loading ? (
            <div className="py-4 text-center text-xs text-text-muted">불러오는 중…</div>
          ) : content ? (
            <MarkdownRenderer content={content} />
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function WorkflowHelpInline({ node }: { node: WorkflowActivityNode }) {
  const refs = deriveHelpRefs(node);
  if (refs.length === 0) return null;
  return (
    <div className="space-y-2">
      {refs.map((r) => (
        <HelpItem key={r.key} refItem={r} />
      ))}
    </div>
  );
}
