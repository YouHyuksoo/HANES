"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isWorkflowKnowledgeInterpretResponse, searchKnowledge as searchKnowledgeCatalog, workflowKnowledgeCatalog, type KnowledgeNode, type WorkflowKnowledgeCandidate } from "@harness/shared";
import api from "@/services/api";
import { createKnowledgeRequestGate, shouldInterpretKnowledgeQuery, validateKnowledgeCandidates } from "../knowledge/knowledge-interactions";

interface Props { onSelect: (nodeId: string) => void; invalidCenter?: string | null }

export function KnowledgeSearch({ onSelect, invalidCenter }: Props) {
  const [query, setQuery] = useState("");
  const [aiCandidates, setAiCandidates] = useState<WorkflowKnowledgeCandidate[]>([]);
  const [status, setStatus] = useState(invalidCenter ? `알 수 없는 중심점: ${invalidCenter}` : "");
  const [loading, setLoading] = useState(false);
  const requestGate = useRef(createKnowledgeRequestGate());
  const abortRequest = useRef<AbortController | null>(null);
  const localResults = useMemo(() => query.trim() ? searchKnowledgeCatalog(query).slice(0, 8) : [], [query]);
  useEffect(() => { setStatus(invalidCenter ? `알 수 없는 중심점: ${invalidCenter}` : ""); }, [invalidCenter]);

  const interpret = async () => {
    if (!query.trim()) return;
    const submittedQuery = query;
    const requestId = requestGate.current.begin(submittedQuery);
    abortRequest.current?.abort();
    const controller = new AbortController();
    abortRequest.current = controller;
    setLoading(true); setStatus("");
    try {
      const response = await api.post("/ai/workflow-knowledge/interpret", { query: submittedQuery }, { suppressErrorModal: true, signal: controller.signal });
      if (!requestGate.current.isCurrent(requestId, submittedQuery)) return;
      if (!isWorkflowKnowledgeInterpretResponse(response.data, workflowKnowledgeCatalog) || !validateKnowledgeCandidates(response.data)) {
        setAiCandidates([]); setStatus("오래되었거나 유효하지 않은 AI 응답을 버렸습니다."); return;
      }
      setAiCandidates(response.data.candidates);
      setStatus(response.data.interpreted ? "" : "AI 해석을 사용할 수 없습니다.");
    } catch { if (requestGate.current.isCurrent(requestId, submittedQuery)) { setAiCandidates([]); setStatus("AI 해석 요청에 실패했습니다."); } }
    finally { if (requestGate.current.isCurrent(requestId, submittedQuery)) setLoading(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); if (shouldInterpretKnowledgeQuery(query, localResults.length, false)) void interpret(); };
  const nodeFor = (id: string): KnowledgeNode | undefined => workflowKnowledgeCatalog.nodes.find((node) => node.id === id);

  return <section className="border-b border-border bg-card p-3" aria-label="지식 검색">
    <form onSubmit={submit} className="flex gap-2">
      <label className="sr-only" htmlFor="knowledge-query">업무, 화면, 테이블 검색</label>
      <input id="knowledge-query" value={query} onChange={(e) => { requestGate.current.invalidate(); abortRequest.current?.abort(); setLoading(false); setStatus(""); setQuery(e.target.value); setAiCandidates([]); }} placeholder="업무 · 화면 · 테이블 · 예외" className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      <button type="submit" className="rounded-md border border-border px-3 text-sm font-semibold text-text focus-visible:ring-2 focus-visible:ring-primary">검색</button>
      <button type="button" onClick={() => void interpret()} disabled={loading || !query.trim()} className="rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50">AI로 질문 해석</button>
    </form>
    {status && <p role="status" className="mt-2 text-xs text-error">{status}</p>}
    {(localResults.length > 0 || aiCandidates.length > 0) && <div className="mt-3 grid gap-3 md:grid-cols-2">
      <ResultGroup title="로컬 카탈로그" items={localResults.map(({ node }) => ({ node, reason: node.description }))} onSelect={onSelect} />
      <ResultGroup title="AI 후보" items={aiCandidates.flatMap((candidate) => { const node = nodeFor(candidate.nodeId); return node ? [{ node, reason: candidate.reason }] : []; })} onSelect={onSelect} />
    </div>}
  </section>;
}

function ResultGroup({ title, items, onSelect }: { title: string; items: { node: KnowledgeNode; reason?: string }[]; onSelect: (id: string) => void }) {
  return <div><h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-text-muted">{title}</h3><ul className="space-y-1">{items.map(({ node, reason }) => <li key={node.id}><button type="button" onClick={() => onSelect(node.id)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"><span className="block text-sm font-semibold text-text">{node.label}</span>{reason && <span className="line-clamp-1 text-xs text-text-muted">{reason}</span>}</button></li>)}</ul></div>;
}
