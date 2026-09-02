"use client";
import { useEffect, useRef, useState } from "react";
import { applyNodeChanges, Background, Controls, MarkerType, MiniMap, ReactFlow, useReactFlow, type Edge, type Node, type NodeChange, type NodeMouseHandler } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { KnowledgeNode } from "./KnowledgeNode";
import { KnowledgeEdge } from "./KnowledgeEdge";
import { fitViewDuration } from "../knowledge/knowledge-interactions";
import { useTranslation } from "react-i18next";

/** 커서 도구 — select: 노드를 잡아 옮긴다 / pan: 빈 곳을 끌어 화면을 옮긴다 */
export type CanvasCursorMode = "select" | "pan";

const nodeTypes = { knowledge: KnowledgeNode };
const edgeTypes = { knowledge: KnowledgeEdge };

function FitSignal({ signal }: { signal: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!signal) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    void fitView({ padding: .18, duration: fitViewDuration(reducedMotion) });
  }, [signal, fitView]);
  return null;
}

/** 카드 실측 크기 — knowledge-layouts의 NODE_WIDTH/HEIGHT와 같은 기준 */
const CARD_W = 224;
const CARD_H = 128;
const CARD_GAP = 24;

/** 두 카드가 겹치는지 — 위치는 좌상단 기준 */
function overlaps(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < CARD_W + CARD_GAP && Math.abs(a.y - b.y) < CARD_H + CARD_GAP;
}

/** 이미 놓인 카드와 겹치면 아래로 한 칸씩 내려 빈자리를 찾는다 */
function pushClear(position: { x: number; y: number }, placed: readonly Node[]): { x: number; y: number } {
  let candidate = { ...position };
  for (let guard = 0; guard < 50; guard++) {
    const hit = placed.find((other) => overlaps(candidate, other.position));
    if (!hit) return candidate;
    candidate = { x: candidate.x, y: hit.position.y + CARD_H + CARD_GAP };
  }
  return candidate;
}

export function KnowledgeCanvas({
  nodes,
  edges,
  onSelect,
  fitSignal,
  cursorMode = "select",
  layoutKey,
}: {
  nodes: Node[];
  edges: Edge[];
  onSelect: (id: string) => void;
  fitSignal: number;
  cursorMode?: CanvasCursorMode;
  /** 이 값이 바뀌면 손으로 옮긴 배치를 버리고 계산된 배치로 돌아간다 */
  layoutKey?: string;
}) {
  const { t } = useTranslation();
  const select: NodeMouseHandler = (_, node) => onSelect(node.id);
  const panMode = cursorMode === "pan";

  // ReactFlow는 컨트롤드 모드라 onNodesChange로 위치를 반영해야 드래그가 남는다.
  const [flowNodes, setFlowNodes] = useState<Node[]>(nodes);

  /**
   * 화면에 떠 있는 노드의 위치를 기억한다.
   *
   * 노드를 클릭하면 그 노드가 펼쳐져 새 노드가 그래프에 들어오고, 레이아웃이 다시 계산된다.
   * 이때 계산 결과를 그대로 적용하면 손대지 않은 노드까지 자리를 옮겨 화면이 흔들린다.
   * 그래서 이미 있던 노드는 자리를 지키고, 새로 등장한 노드만 계산된 자리에 놓는다.
   * (손으로 끌어 옮긴 위치도 같은 방식으로 유지된다)
   */
  const keptPositions = useRef(new Map<string, { x: number; y: number }>());

  // 레이아웃이나 중심 노드가 바뀌면 지금 배치를 버리고 새로 계산된 배치로 간다.
  useEffect(() => { keptPositions.current.clear(); }, [layoutKey]);

  useEffect(() => {
    // 기존 노드는 자리를 지키고, 새 노드는 계산된 자리에서 시작하되
    // 이미 있는 노드와 부딪히면 아래로 밀어 겹치지 않게 한다.
    // (레이아웃은 전부 새로 놓는 기준으로 계산하므로, 자리를 지킨 노드와 어긋나 겹칠 수 있다)
    const placed: Node[] = [];
    const next = nodes.map((node) => {
      const kept = keptPositions.current.get(node.id);
      const resolved = kept ? { ...node, position: kept } : { ...node, position: pushClear(node.position, placed) };
      placed.push(resolved);
      return resolved;
    });
    // 사라진 노드는 기억에서 지운다(다시 등장하면 계산된 자리에서 시작한다).
    const alive = new Set(nodes.map((node) => node.id));
    for (const id of [...keptPositions.current.keys()]) {
      if (!alive.has(id)) keptPositions.current.delete(id);
    }
    for (const node of next) keptPositions.current.set(node.id, node.position);
    setFlowNodes(next);
  }, [nodes]);

  const handleNodesChange = (changes: NodeChange[]) => {
    for (const change of changes) {
      // 드래그가 끝난 시점의 좌표만 기억한다(끄는 중 좌표는 저장하지 않는다).
      if (change.type === "position" && !change.dragging && change.position) {
        keptPositions.current.set(change.id, change.position);
      }
    }
    setFlowNodes((current) => applyNodeChanges(changes, current));
  };

  return (
    <div
      className={`min-h-0 h-full bg-background bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:24px_24px] ${
        panMode ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      aria-label={t("workflowGuide.knowledge.canvas.label")}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.target as HTMLElement).dataset.id) onSelect((event.target as HTMLElement).dataset.id!);
      }}
    >
      <ReactFlow
        nodes={flowNodes}
        onNodesChange={handleNodesChange}
        edges={edges.map((edge) => ({ ...edge, type: "knowledge", markerEnd: { type: MarkerType.ArrowClosed } }))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={select}
        onSelectionChange={({ nodes: selected }) => { if (selected[0]) onSelect(selected[0].id); }}
        // 노드를 직접 끌어 배치를 바꿀 수 있다. 위치는 화면에만 남고 저장하지 않는다.
        nodesDraggable
        nodesConnectable={false}
        nodesFocusable
        elementsSelectable
        // 손 도구: 빈 곳을 끌면 화면 이동. 포인터 도구: 왼쪽 드래그는 영역 선택, 화면 이동은 휠/중간버튼.
        panOnDrag={panMode ? true : [1, 2]}
        selectionOnDrag={!panMode}
        fitView
        attributionPosition="bottom-left"
      >
        <FitSignal signal={fitSignal} />
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable ariaLabel={t("workflowGuide.knowledge.canvas.minimap")} />
      </ReactFlow>
    </div>
  );
}
