"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { expandKnowledgeNeighborhood, getKnowledgeGraphIndex, workflowKnowledgeCatalog, KNOWLEDGE_CATEGORIES, type KnowledgeCategory, type KnowledgeNode, type KnowledgeRelation, type KnowledgeRelationCategory } from "@harness/shared";
import { KnowledgeNavigationModel, type KnowledgeNavigationSnapshot, type LayoutMode, type ViewMode } from "../knowledge/knowledge-state";
import { KNOWLEDGE_LAYOUTS, safeLayout } from "../knowledge/knowledge-layouts";
import { createKnowledgeViewModel } from "../knowledge/knowledge-view-model";
import { KnowledgeSearch } from "./KnowledgeSearch";
import { KnowledgeToolbar } from "./KnowledgeToolbar";
import { RelationFilters } from "./RelationFilters";
import { KnowledgeCanvas } from "./KnowledgeCanvas";
import { KnowledgeDetailPanel } from "./KnowledgeDetailPanel";
import { deriveKnowledgeNodeEvidenceStatuses, recenterKnowledge, restoreKnowledgeCenter, selectGraphNode, selectSearchResult, type KnowledgeInteractionState } from "../knowledge/knowledge-interactions";

const firstLegacyActivity = workflowKnowledgeCatalog.nodes.find((node) => node.kind === "activity") ?? workflowKnowledgeCatalog.nodes[0];
const emptySnapshot: KnowledgeNavigationSnapshot = { centerId:null, invalidCenter:null, layout:"mindmap", view:"business", relations:[...KNOWLEDGE_CATEGORIES], canGoBack:false, canGoForward:false };

export function WorkflowKnowledgeMap() {
  const navigation = useRef<KnowledgeNavigationModel | null>(null);
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<string[]>([]);
  const [fitSignal, setFitSignal] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
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
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopyStatus("링크를 복사했습니다."); } catch { setCopyStatus("링크를 복사하지 못했습니다."); } };
  const setLayout = (v:LayoutMode)=>update((m)=>m.setLayout(v)); const setView=(v:ViewMode)=>update((m)=>m.setView(v));

  return <div className="flex h-[calc(100dvh-8rem)] min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-text">
    <header className="bg-card"><div className="flex items-end justify-between gap-4 border-b border-border px-4 py-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-muted">HANES · KNOWLEDGE BLUEPRINT</p><h1 className="text-lg font-semibold">업무 지식 관계도</h1></div><p className="hidden max-w-lg text-right text-xs text-text-muted lg:block">노드를 선택하면 한 단계 관계가 펼쳐집니다. 중심 이동은 상세 패널에서 명시적으로 실행합니다.</p></div><KnowledgeSearch onSelect={selectSearch} invalidCenter={snapshot.invalidCenter} /><KnowledgeToolbar layout={snapshot.layout} view={snapshot.view} canGoBack={snapshot.canGoBack} canGoForward={snapshot.canGoForward} onLayout={setLayout} onView={setView} onBack={()=>restoreHistory("back")} onForward={()=>restoreHistory("forward")} onReset={reset} onFitView={()=>setFitSignal((v)=>v+1)} onCopyLink={()=>void copyLink()} copyStatus={copyStatus} /></header>
    {snapshot.invalidCenter ? <div className="grid flex-1 place-items-center p-6"><div className="max-w-md border-l-4 border-warning bg-card p-5"><p className="font-mono text-xs text-warning">CENTER NOT FOUND</p><h2 className="mt-2 text-lg font-semibold">공유 링크의 중심점을 찾을 수 없습니다.</h2><p className="mt-2 text-sm text-text-muted">상단 검색에서 현재 카탈로그의 업무·화면·테이블을 선택해 복구하세요. 자동으로 다른 중심점으로 바꾸지 않았습니다.</p></div></div> : graph && center ? <>
      <div className="hidden min-h-0 flex-1 md:grid md:grid-cols-[15rem_minmax(0,1fr)] 2xl:grid-cols-[15rem_minmax(0,1fr)_22rem]"><RelationFilters active={snapshot.relations.filter((v):v is KnowledgeCategory=>(KNOWLEDGE_CATEGORIES as readonly string[]).includes(v))} relations={graph.relations} coverage={center.coverage} onChange={(v)=>update((m)=>m.setRelations([...v, ...(snapshot.relations.includes("evidence")?["evidence" as const]:[])]))} /><main className="min-h-0"><KnowledgeCanvas nodes={model.nodes} edges={model.edges} onSelect={selectNode} fitSignal={fitSignal} /></main>{selected && <div className="hidden 2xl:block"><KnowledgeDetailPanel node={selected} relations={graph.relations} catalog={workflowKnowledgeCatalog.nodes} view={snapshot.view} isCenter={selected.id===center.id} onCenter={()=>recenter(selected.id)} /></div>}{selected && <div className="fixed inset-y-20 right-0 z-30 hidden w-96 shadow-xl md:block 2xl:hidden"><KnowledgeDetailPanel node={selected} relations={graph.relations} catalog={workflowKnowledgeCatalog.nodes} view={snapshot.view} isCenter={selected.id===center.id} onCenter={()=>recenter(selected.id)} /></div>}</div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 md:hidden"><RelationFilters compact active={snapshot.relations.filter((v):v is KnowledgeCategory=>(KNOWLEDGE_CATEGORIES as readonly string[]).includes(v))} relations={graph.relations} coverage={center.coverage} onChange={(v)=>update((m)=>m.setRelations([...v, ...(snapshot.relations.includes("evidence")?["evidence" as const]:[])]))} /><CenterSummary node={center} /><h2 className="mt-5 font-mono text-xs uppercase tracking-wider text-text-muted">관계 목록</h2><div className="mt-2 space-y-2">{graph.relations.map((relation)=><button type="button" key={relation.id} onClick={()=>selectNode(relation.source===center.id?relation.target:relation.source)} className="w-full rounded-md border border-border bg-card p-3 text-left text-sm"><span className="font-mono text-[10px] text-text-muted">{relation.kind} · {relation.evidenceStatus}</span><strong className="block">{workflowKnowledgeCatalog.nodes.find((n)=>n.id===(relation.source===center.id?relation.target:relation.source))?.label}</strong></button>)}</div>{selected && <div className="mt-4"><KnowledgeDetailPanel node={selected} relations={graph.relations} catalog={workflowKnowledgeCatalog.nodes} view={snapshot.view} isCenter={selected.id===center.id} onCenter={()=>recenter(selected.id)} /></div>}</div>
    </> : null}
  </div>;
}
function CenterSummary({node}:{node:KnowledgeNode}) { return <section className="border-l-4 border-primary bg-card p-4"><p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">CURRENT CENTER · {node.kind}</p><h2 className="mt-1 text-lg font-semibold">{node.label}</h2><p className="mt-1 text-sm text-text-muted">{node.description}</p></section>; }

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
