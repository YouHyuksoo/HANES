"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { expandKnowledgeNeighborhood, getKnowledgeGraphIndex, workflowKnowledgeCatalog, KNOWLEDGE_CATEGORIES, type KnowledgeCategory, type KnowledgeNode, type KnowledgeRelation, type KnowledgeRelationCategory } from "@harness/shared";
import { KnowledgeNavigationModel, type KnowledgeNavigationSnapshot, type ViewMode } from "../knowledge/knowledge-state";
import { KNOWLEDGE_LAYOUTS, safeLayout } from "../knowledge/knowledge-layouts";
import { createKnowledgeViewModel } from "../knowledge/knowledge-view-model";
import { KnowledgeSearch } from "./KnowledgeSearch";
import { KnowledgeToolbar } from "./KnowledgeToolbar";
import { RelationFilters } from "./RelationFilters";
import { KnowledgeCanvas, type CanvasCursorMode } from "./KnowledgeCanvas";
import { KnowledgeDetailPanel } from "./KnowledgeDetailPanel";
import { deriveKnowledgeNodeEvidenceStatuses, recenterKnowledge, restoreKnowledgeCenter, selectGraphNode, selectSearchResult, type KnowledgeInteractionState } from "../knowledge/knowledge-interactions";
import { useTranslation } from "react-i18next";
import { Network } from "lucide-react";

const firstLegacyActivity = workflowKnowledgeCatalog.nodes.find((node) => node.kind === "activity") ?? workflowKnowledgeCatalog.nodes[0];
// 초기 스냅샷도 흐름만 켠다(knowledge-state의 DEFAULT_RELATIONS와 같은 기준).
const emptySnapshot: KnowledgeNavigationSnapshot = { centerId:null, invalidCenter:null, layout:"mindmap", view:"business", relations:["flow"], canGoBack:false, canGoForward:false };

export function WorkflowKnowledgeMap() {
  const { t } = useTranslation();
  const navigation = useRef<KnowledgeNavigationModel | null>(null);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [fitSignal, setFitSignal] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const [cursorMode, setCursorMode] = useState<CanvasCursorMode>("select");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  // 전체화면은 브라우저가 ESC로도 빠져나가므로 상태를 이벤트로 맞춘다.
  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    void shellRef.current?.requestFullscreen?.();
  };
  useEffect(() => { navigation.current = new KnowledgeNavigationModel({ location:window.location, history:window.history, localStorage:window.localStorage }); setSnapshot(navigation.current.snapshot); }, []);
  const update = (action: (model: KnowledgeNavigationModel) => void) => { if (!navigation.current) return; action(navigation.current); setSnapshot(navigation.current.snapshot); };
  const center = workflowKnowledgeCatalog.nodes.find((node) => node.id === snapshot.centerId);
  const graph = useMemo(
    () => center ? buildKnowledgeGraph(center, expandedNodeIds, snapshot.relations) : null,
    [center, expandedNodeIds, snapshot.relations],
  );
  const model = useMemo(() => { if (!graph || !center) return { nodes:[], edges:[] }; const positioned = safeLayout(KNOWLEDGE_LAYOUTS[snapshot.layout], graph); const result = createKnowledgeViewModel(graph, positioned, { centerId:center.id, selectedNodeId, viewMode:snapshot.view, relationCategories:snapshot.relations }); const evidenceStatuses = deriveKnowledgeNodeEvidenceStatuses(graph.nodes, graph.relations); return { ...result, nodes:result.nodes.map((node) => ({ ...node, data:{ ...node.data, center:node.id===center.id, evidenceStatus:evidenceStatuses[node.id] } })) }; }, [graph, center, selectedNodeId, snapshot.layout, snapshot.view, snapshot.relations]);
  const selected = workflowKnowledgeCatalog.nodes.find((node) => node.id === selectedNodeId) ?? center;
  const interactionState = (): KnowledgeInteractionState => ({ centerId:snapshot.centerId, invalidCenter:snapshot.invalidCenter, selectedNodeId, expandedNodeIds, fitRevision:fitSignal });
  const applyInteraction = (next: KnowledgeInteractionState) => { setSelectedNodeId(next.selectedNodeId); setExpandedNodeIds(next.expandedNodeIds); setFitSignal(next.fitRevision); };
  const selectNode = (nodeId: string) => applyInteraction(selectGraphNode(interactionState(), nodeId));
  const selectSearch = (nodeId: string) => { const next = selectSearchResult(interactionState(), nodeId); if (!snapshot.centerId) update((m)=>m.setCenter(nodeId)); applyInteraction(next); };
  const recenter = (nodeId: string) => { update((m)=>m.setCenter(nodeId)); applyInteraction(recenterKnowledge(interactionState(), nodeId)); };
  const restoreHistory = (direction: "back" | "forward") => { update((m)=>{ direction === "back" ? m.goBack() : m.goForward(); }); const restored = navigation.current?.snapshot.centerId ?? null; applyInteraction(restoreKnowledgeCenter(interactionState(), restored)); };
  const reset = () => { if (firstLegacyActivity) recenter(firstLegacyActivity.id); };
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopyStatus(t("workflowGuide.knowledge.toolbar.copySuccess")); } catch { setCopyStatus(t("workflowGuide.knowledge.toolbar.copyFailed")); } };
  const setView=(v:ViewMode)=>update((m)=>m.setView(v));

  return <div ref={shellRef} className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-text">
    {/* 제목·검색·도구를 한 줄에 둔다. 캔버스에 최대한 높이를 넘긴다. */}
    <header className="relative flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-3 py-2">
      <h1 className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold" title={t("workflowGuide.knowledge.description")}>
        <Network className="h-4 w-4 text-primary" />
        {t("workflowGuide.knowledge.title")}
      </h1>
      <KnowledgeSearch onSelect={selectSearch} invalidCenter={snapshot.invalidCenter} />
      <KnowledgeToolbar view={snapshot.view} canGoBack={snapshot.canGoBack} canGoForward={snapshot.canGoForward} canRecenter={!!selected && !!center && selected.id !== center.id} cursorMode={cursorMode} isFullscreen={isFullscreen} onView={setView} onCursorMode={setCursorMode} onBack={()=>restoreHistory("back")} onForward={()=>restoreHistory("forward")} onReset={reset} onRecenter={()=>{ if (selected) recenter(selected.id); }} onFitView={()=>setFitSignal((v)=>v+1)} onCopyLink={()=>void copyLink()} onToggleFullscreen={toggleFullscreen} copyStatus={copyStatus} />
    </header>
    {snapshot.invalidCenter ? <div className="grid flex-1 place-items-center p-6"><div className="max-w-md border-l-4 border-warning bg-card p-5"><p className="font-mono text-xs text-warning">{t("workflowGuide.knowledge.recovery.code")}</p><h2 className="mt-2 text-lg font-semibold">{t("workflowGuide.knowledge.recovery.title")}</h2><p className="mt-2 text-sm text-text-muted">{t("workflowGuide.knowledge.recovery.description")}</p></div></div> : graph && center ? <>
      <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_22rem]"><RelationFilters active={snapshot.relations.filter((v):v is KnowledgeCategory=>(KNOWLEDGE_CATEGORIES as readonly string[]).includes(v))} relations={graph.relations} coverage={center.coverage} onChange={(v)=>update((m)=>m.setRelations([...v, ...(snapshot.relations.includes("evidence")?["evidence" as const]:[])]))} /><main className="min-h-0"><KnowledgeCanvas nodes={model.nodes} edges={model.edges} onSelect={selectNode} fitSignal={fitSignal} cursorMode={cursorMode} layoutKey={`${snapshot.layout}:${snapshot.centerId ?? ""}`} /></main>{selected && <div className="hidden 2xl:block"><KnowledgeDetailPanel node={selected} relations={graph.relations} catalog={workflowKnowledgeCatalog.nodes} view={snapshot.view} isCenter={selected.id===center.id} onCenter={()=>recenter(selected.id)} /></div>}{selected && <div className="fixed inset-y-20 right-0 z-30 hidden w-96 shadow-xl md:block 2xl:hidden"><KnowledgeDetailPanel node={selected} relations={graph.relations} catalog={workflowKnowledgeCatalog.nodes} view={snapshot.view} isCenter={selected.id===center.id} onCenter={()=>recenter(selected.id)} /></div>}</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:hidden"><RelationFilters compact active={snapshot.relations.filter((v):v is KnowledgeCategory=>(KNOWLEDGE_CATEGORIES as readonly string[]).includes(v))} relations={graph.relations} coverage={center.coverage} onChange={(v)=>update((m)=>m.setRelations([...v, ...(snapshot.relations.includes("evidence")?["evidence" as const]:[])]))} /><CenterSummary node={center} /><h2 className="mt-5 font-mono text-xs uppercase tracking-wider text-text-muted">{t("workflowGuide.knowledge.relationList")}</h2><div className="mt-2 space-y-2">{graph.relations.length ? graph.relations.map((relation)=><button type="button" key={relation.id} onClick={()=>selectNode(relation.source===center.id?relation.target:relation.source)} className="w-full rounded-md border border-border bg-card p-3 text-left text-sm"><span className="font-mono text-[10px] text-text-muted">{relation.kind} · {t(`workflowGuide.knowledge.evidenceStatus.${relation.evidenceStatus}`)}</span><strong className="block">{workflowKnowledgeCatalog.nodes.find((n)=>n.id===(relation.source===center.id?relation.target:relation.source))?.label}</strong></button>) : <p className="text-sm text-text-muted">{t("workflowGuide.knowledge.emptyRelations")}</p>}</div>{selected && <div className="mt-4"><KnowledgeDetailPanel node={selected} relations={graph.relations} catalog={workflowKnowledgeCatalog.nodes} view={snapshot.view} isCenter={selected.id===center.id} onCenter={()=>recenter(selected.id)} /></div>}</div>
    </> : null}
  </div>;
}
function CenterSummary({node}:{node:KnowledgeNode}) { const { t } = useTranslation(); return <section className="border-l-4 border-primary bg-card p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{t("workflowGuide.knowledge.currentCenter")} · {node.kind}</p><h2 className="mt-1 text-lg font-semibold">{node.label}</h2><p className="mt-1 text-sm text-text-muted">{node.description ?? t("workflowGuide.knowledge.detail.noDescription")}</p></section>; }

function buildKnowledgeGraph(center: KnowledgeNode, expandedNodeIds: readonly string[], categories: readonly KnowledgeRelationCategory[]) {
  const semantic = categories.filter((category): category is KnowledgeCategory =>
    (KNOWLEDGE_CATEGORIES as readonly string[]).includes(category));
  const expanded = expandKnowledgeNeighborhood([center.id, ...expandedNodeIds], semantic);
  const relationById = new Map(expanded.relations.map((relation) => [relation.id, relation]));

  if (categories.includes("evidence")) {
    const index = getKnowledgeGraphIndex(workflowKnowledgeCatalog);
    for (const node of expanded.nodes) {
      for (const relation of index.relationsByNode.get(node.id) ?? []) {
        if (relation.category === "evidence") relationById.set(relation.id, relation);
      }
    }
  }

  const relations: KnowledgeRelation[] = [...relationById.values()];
  const nodeIds = new Set([center.id, ...relations.flatMap((relation) => [relation.source, relation.target])]);
  return { center, nodes: workflowKnowledgeCatalog.nodes.filter((node) => nodeIds.has(node.id)), relations };
}
