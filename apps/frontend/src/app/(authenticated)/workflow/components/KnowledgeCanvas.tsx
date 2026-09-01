"use client";
import { useEffect } from "react";
import { Background, Controls, MarkerType, MiniMap, ReactFlow, useReactFlow, type Edge, type Node, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KnowledgeNode } from "./KnowledgeNode";
import { KnowledgeEdge } from "./KnowledgeEdge";
import { fitViewDuration } from "../knowledge/knowledge-interactions";
import { useTranslation } from "react-i18next";
const nodeTypes = { knowledge: KnowledgeNode };
const edgeTypes = { knowledge: KnowledgeEdge };
function FitSignal({ signal }: { signal: number }) { const { fitView } = useReactFlow(); useEffect(() => { if (!signal) return; const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; void fitView({ padding: .18, duration: fitViewDuration(reducedMotion) }); }, [signal, fitView]); return null; }
export function KnowledgeCanvas({ nodes, edges, onSelect, fitSignal }: { nodes: Node[]; edges: Edge[]; onSelect: (id:string) => void; fitSignal: number }) {
  const { t } = useTranslation();
  const select: NodeMouseHandler = (_, node) => onSelect(node.id);
  return <div className="min-h-0 h-full bg-background bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px]" aria-label={t("workflowGuide.knowledge.canvas.label")} onKeyDown={(event) => { if (event.key === "Enter" && (event.target as HTMLElement).dataset.id) onSelect((event.target as HTMLElement).dataset.id!); }}>
    <ReactFlow nodes={nodes} edges={edges.map((edge) => ({ ...edge, type:"knowledge", markerEnd:{ type:MarkerType.ArrowClosed } }))} nodeTypes={nodeTypes} edgeTypes={edgeTypes} onNodeClick={select} onSelectionChange={({ nodes: selected }) => { if (selected[0]) onSelect(selected[0].id); }} nodesDraggable={false} nodesConnectable={false} nodesFocusable elementsSelectable fitView attributionPosition="bottom-left"><FitSignal signal={fitSignal} /><Background gap={24} size={1} /><Controls showInteractive={false} /><MiniMap pannable zoomable ariaLabel={t("workflowGuide.knowledge.canvas.minimap")} /></ReactFlow>
  </div>;
}
