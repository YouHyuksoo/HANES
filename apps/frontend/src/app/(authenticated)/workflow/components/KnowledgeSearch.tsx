"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { isWorkflowKnowledgeInterpretResponse, searchKnowledge as searchKnowledgeCatalog, workflowKnowledgeCatalog, type KnowledgeNode, type WorkflowKnowledgeCandidate } from "@harness/shared";
import api from "@/services/api";
import { createKnowledgeRequestGate, shouldInterpretKnowledgeQuery, validateKnowledgeCandidates } from "../knowledge/knowledge-interactions";
import { useTranslation } from "react-i18next";

interface Props { onSelect: (nodeId: string) => void; invalidCenter?: string | null }

export function KnowledgeSearch({ onSelect, invalidCenter }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [aiCandidates, setAiCandidates] = useState<WorkflowKnowledgeCandidate[]>([]);
  const [status, setStatus] = useState(invalidCenter ? t("workflowGuide.knowledge.search.invalidCenter", { center: invalidCenter }) : "");
  const [loading, setLoading] = useState(false);
  const requestGate = useRef(createKnowledgeRequestGate());
  const abortRequest = useRef<AbortController | null>(null);
  const localResults = useMemo(() => query.trim() ? searchKnowledgeCatalog(query).slice(0, 8) : [], [query]);
  useEffect(() => { setStatus(invalidCenter ? t("workflowGuide.knowledge.search.invalidCenter", { center: invalidCenter }) : ""); }, [invalidCenter, t]);

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
        setAiCandidates([]); setStatus(t("workflowGuide.knowledge.search.staleAi")); return;
      }
      setAiCandidates(response.data.candidates);
      setStatus(response.data.interpreted ? "" : t("workflowGuide.knowledge.search.aiUnavailable"));
    } catch { if (requestGate.current.isCurrent(requestId, submittedQuery)) { setAiCandidates([]); setStatus(t("workflowGuide.knowledge.search.aiFailed")); } }
    finally { if (requestGate.current.isCurrent(requestId, submittedQuery)) setLoading(false); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); if (shouldInterpretKnowledgeQuery(query, localResults.length, false)) void interpret(); };
  const nodeFor = (id: string): KnowledgeNode | undefined => workflowKnowledgeCatalog.nodes.find((node) => node.id === id);

  return <section className="min-w-0 flex-1" aria-label={t("workflowGuide.knowledge.search.label")}>
    <form onSubmit={submit} className="flex gap-1.5">
      <label className="sr-only" htmlFor="knowledge-query">{t("workflowGuide.knowledge.search.label")}</label>
      <input id="knowledge-query" value={query} onChange={(e) => { requestGate.current.invalidate(); abortRequest.current?.abort(); setLoading(false); setStatus(""); setQuery(e.target.value); setAiCandidates([]); }} placeholder={t("workflowGuide.knowledge.search.placeholder")} className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      <button type="submit" className="h-7 shrink-0 rounded-md border border-border px-2.5 text-xs font-semibold text-text focus-visible:ring-2 focus-visible:ring-primary">{t("workflowGuide.knowledge.search.action")}</button>
      <button type="button" onClick={() => void interpret()} disabled={loading || !query.trim()} className="h-7 shrink-0 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{loading ? t("workflowGuide.knowledge.search.aiLoading") : t("workflowGuide.knowledge.search.aiAction")}</button>
    </form>
    {status && <p role="status" className="mt-1 text-[11px] text-error">{status}</p>}
    {query.trim() && <div className="absolute left-0 right-0 top-full z-20 mt-1 grid gap-3 border-b border-border bg-card p-3 shadow-lg md:grid-cols-2">
      <ResultGroup title={t("workflowGuide.knowledge.search.localResults")} empty={t("workflowGuide.knowledge.search.noLocalResults")} items={localResults.map(({ node }) => ({ node, reason: node.description }))} onSelect={onSelect} />
      <ResultGroup title={t("workflowGuide.knowledge.search.aiResults")} empty={t("workflowGuide.knowledge.search.noAiResults")} items={aiCandidates.flatMap((candidate) => { const node = nodeFor(candidate.nodeId); return node ? [{ node, reason: candidate.reason }] : []; })} onSelect={onSelect} />
    </div>}
  </section>;
}

function ResultGroup({ title, empty, items, onSelect }: { title: string; empty: string; items: { node: KnowledgeNode; reason?: string }[]; onSelect: (id: string) => void }) {
  return <div><h3 className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-text-muted">{title}</h3>{items.length ? <ul className="space-y-1">{items.map(({ node, reason }) => <li key={node.id}><button type="button" onClick={() => onSelect(node.id)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-left hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"><span className="block text-sm font-semibold text-text">{node.label}</span>{reason && <span className="line-clamp-1 text-xs text-text-muted">{reason}</span>}</button></li>)}</ul> : <p className="rounded-md border border-dashed border-border p-3 text-xs text-text-muted">{empty}</p>}</div>;
}
