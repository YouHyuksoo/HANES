"use client";

/**
 * @file src/app/(authenticated)/workflow/page.tsx
 * @description 업무 이해용 워크플로우 맵 — React Flow 기반 업무/시스템 연관도 시각화
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Eye,
  EyeOff,
  ArrowRight,
  Database,
  ExternalLink,
  Filter,
  GitBranch,
  Layers3,
  Search,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui";
import {
  workflowEdges,
  workflowLanes,
  workflowNodes,
  type WorkflowActivityNode,
  type WorkflowLane,
} from "@/config/workflowMap";

interface ActivityNodeData extends Record<string, unknown> {
  activity: WorkflowActivityNode;
  lane: WorkflowLane;
  selected: boolean;
  dimmed: boolean;
}

interface LaneNodeData extends Record<string, unknown> {
  lane: WorkflowLane;
}

type ActivityFlowNode = Node<ActivityNodeData, "activity">;
type LaneFlowNode = Node<LaneNodeData, "lane">;
type WorkflowFlowNode = ActivityFlowNode | LaneFlowNode;

const nodeTypes = {
  activity: ActivityNode,
  lane: LaneNode,
};

const laneById = new Map(workflowLanes.map((lane) => [lane.id, lane]));
const nodeById = new Map(workflowNodes.map((node) => [node.id, node]));

export default function WorkflowPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeLaneIds, setActiveLaneIds] = useState(() => new Set(workflowLanes.map((lane) => lane.id)));
  const [selectedNodeId, setSelectedNodeId] = useState(workflowNodes[0]?.id ?? "");
  const [showAllRelations, setShowAllRelations] = useState(false);

  const selectedNode = nodeById.get(selectedNodeId) ?? workflowNodes[0];
  const normalizedQuery = query.trim().toLowerCase();

  const visibleActivityIds = useMemo(() => {
    return new Set(
      workflowNodes
        .filter((node) => activeLaneIds.has(node.lane))
        .filter((node) => {
          if (!normalizedQuery) return true;
          const haystack = [
            node.activity,
            node.summary,
            node.detail,
            ...node.dataObjects,
            ...node.inputs,
            ...node.outputs,
            ...node.routes.map((route) => route.label),
          ].join(" ").toLowerCase();
          return haystack.includes(normalizedQuery);
        })
        .map((node) => node.id),
    );
  }, [activeLaneIds, normalizedQuery]);

  const flowNodes: WorkflowFlowNode[] = useMemo(() => {
    const laneNodes: LaneFlowNode[] = workflowLanes.map((lane) => ({
      id: `lane-${lane.id}`,
      type: "lane",
      position: { x: -260, y: lane.y - 50 },
      data: { lane },
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      zIndex: -1,
      style: { width: 3100, height: 152 },
    }));

    const activityNodes: ActivityFlowNode[] = workflowNodes.map((activity) => {
      const lane = laneById.get(activity.lane)!;
      const visible = visibleActivityIds.has(activity.id);
      return {
        id: activity.id,
        type: "activity",
        position: { x: activity.x, y: lane.y },
        data: {
          activity,
          lane,
          selected: activity.id === selectedNode?.id,
          dimmed: !visible,
        },
        hidden: !visible,
        draggable: false,
      };
    });

    return [...laneNodes, ...activityNodes];
  }, [selectedNode?.id, visibleActivityIds]);

  const flowEdges: Edge[] = useMemo(() => {
    return workflowEdges
      .filter((edge) => visibleActivityIds.has(edge.source) && visibleActivityIds.has(edge.target))
      .filter((edge) => {
        if (edge.kind === "normal" || edge.kind === "branch") return true;
        return showAllRelations || edge.source === selectedNode?.id || edge.target === selectedNode?.id;
      })
      .map((edge) => {
        const isReversal = edge.kind === "reversal";
        const isReference = edge.kind === "reference";
        const isFocused = edge.source === selectedNode?.id || edge.target === selectedNode?.id;
        const color = isReversal ? "#64748b" : isReference ? "#0891b2" : edge.kind === "branch" ? "#d97706" : "#2563eb";
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: "smoothstep",
          label: isFocused ? edge.label : undefined,
          animated: isFocused && (isReversal || isReference),
          markerEnd: { type: MarkerType.ArrowClosed, color },
          style: {
            stroke: color,
            strokeWidth: isFocused ? 2.4 : 1.7,
            opacity: isReference || isReversal ? 0.76 : 0.9,
            strokeDasharray: isReversal ? "7 5" : isReference ? "4 4" : undefined,
          },
          labelStyle: {
            fill: "#334155",
            fontSize: 11,
            fontWeight: 600,
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.88,
          },
        } satisfies Edge;
      });
  }, [selectedNode?.id, showAllRelations, visibleActivityIds]);

  const previousNodes = useMemo(() => (
    workflowEdges
      .filter((edge) => edge.target === selectedNode?.id)
      .map((edge) => ({ edge, node: nodeById.get(edge.source) }))
      .filter((item): item is { edge: typeof workflowEdges[number]; node: WorkflowActivityNode } => Boolean(item.node))
  ), [selectedNode?.id]);

  const nextNodes = useMemo(() => (
    workflowEdges
      .filter((edge) => edge.source === selectedNode?.id)
      .map((edge) => ({ edge, node: nodeById.get(edge.target) }))
      .filter((item): item is { edge: typeof workflowEdges[number]; node: WorkflowActivityNode } => Boolean(item.node))
  ), [selectedNode?.id]);

  const toggleLane = (laneId: WorkflowLane["id"]) => {
    setActiveLaneIds((current) => {
      const next = new Set(current);
      if (next.has(laneId) && next.size > 1) {
        next.delete(laneId);
      } else {
        next.add(laneId);
      }
      return next;
    });
  };

  return (
    <div className="h-full min-h-0 overflow-hidden bg-background text-text flex flex-col">
      <header className="shrink-0 border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-lg border border-border bg-card flex items-center justify-center">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold">업무 워크플로우 맵</h1>
              <p className="text-xs text-text-muted truncate">
                입하부터 출하, 추적, 역처리까지 업무 활동과 시스템 화면의 관계를 보여줍니다.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1">
              <Workflow className="h-3.5 w-3.5 text-primary" />
              주 흐름
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1">
              <Layers3 className="h-3.5 w-3.5 text-cyan-600" />
              선택 업무 중심
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <label className="relative block w-[360px] max-w-[44vw]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="업무, 화면, 데이터 객체 검색"
              className="h-9 w-full rounded border border-border bg-background pl-8 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="inline-flex items-center gap-1 px-2 text-xs text-text-muted">
              <Filter className="h-3.5 w-3.5" />
              레인
            </span>
            {workflowLanes.map((lane) => {
              const active = activeLaneIds.has(lane.id);
              return (
                <button
                  key={lane.id}
                  type="button"
                  onClick={() => toggleLane(lane.id)}
                  className={`h-8 shrink-0 rounded border px-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-transparent text-white"
                      : "border-border bg-card text-text-muted hover:bg-muted"
                  }`}
                  style={active ? { backgroundColor: lane.color } : undefined}
                >
                  {lane.title}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setShowAllRelations((current) => !current)}
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-border bg-card px-2.5 text-xs font-semibold text-text-muted hover:bg-muted"
          >
            {showAllRelations ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showAllRelations ? "보조 연결 숨김" : "보조 연결 보기"}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_390px] flex-1 min-h-0 overflow-hidden">
        <main className="min-h-0 overflow-hidden border-r border-border">
          <ReactFlow
            className="h-full w-full"
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            defaultViewport={{ x: 180, y: 28, zoom: 0.62 }}
            minZoom={0.16}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            onNodeClick={(_, node) => {
              if (node.type === "activity") setSelectedNodeId(node.id);
            }}
          >
            <Background gap={28} />
            <Controls position="top-right" showInteractive={false} />
          </ReactFlow>
        </main>

        <aside data-workflow-detail-panel="true" className="min-h-0 overflow-auto bg-card p-4">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded border border-border bg-background px-2 py-1 text-xs font-semibold text-text-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: laneById.get(selectedNode.lane)?.color }}
                  />
                  {laneById.get(selectedNode.lane)?.title}
                </div>
                <h2 className="text-xl font-semibold">{selectedNode.activity}</h2>
                <p className="mt-2 text-sm text-text-muted leading-6">{selectedNode.detail}</p>
              </div>

              <section className="rounded-lg border border-border bg-background p-3">
                <h3 className="mb-2 text-sm font-semibold">관련 화면</h3>
                <div className="space-y-2">
                  {selectedNode.routes.map((route) => (
                    <Button
                      key={route.path}
                      variant="secondary"
                      size="sm"
                      className="w-full justify-between"
                      onClick={() => router.push(route.path)}
                    >
                      <span>{route.label}</span>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border border-border bg-background p-3">
                <h3 className="mb-2 text-sm font-semibold">생성/변경 데이터</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selectedNode.dataObjects.map((object) => (
                    <span key={object} className="rounded border border-border bg-card px-2 py-1 font-mono text-[11px] text-text-muted">
                      <Database className="mr-1 inline h-3 w-3" />
                      {object}
                    </span>
                  ))}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <ListBlock title="입력" items={selectedNode.inputs} />
                <ListBlock title="산출" items={selectedNode.outputs} />
              </section>

              <section className="rounded-lg border border-border bg-background p-3">
                <h3 className="mb-2 text-sm font-semibold">선행 업무</h3>
                {previousNodes.length === 0 ? (
                  <p className="text-xs text-text-muted">이 맵의 시작 업무입니다.</p>
                ) : (
                  <div className="space-y-2">
                    {previousNodes.map(({ edge, node }) => (
                      <RelationButton
                        key={edge.id}
                        label={node.activity}
                        edgeLabel={edge.label}
                        onClick={() => setSelectedNodeId(node.id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-border bg-background p-3">
                <h3 className="mb-2 text-sm font-semibold">후행 업무</h3>
                {nextNodes.length === 0 ? (
                  <p className="text-xs text-text-muted">이 맵의 종료 또는 조회 업무입니다.</p>
                ) : (
                  <div className="space-y-2">
                    {nextNodes.map(({ edge, node }) => (
                      <RelationButton
                        key={edge.id}
                        label={node.activity}
                        edgeLabel={edge.label}
                        onClick={() => setSelectedNodeId(node.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="text-sm text-text-muted">업무 노드를 선택하세요.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ActivityNode({ data }: NodeProps<ActivityFlowNode>) {
  return (
    <button
      type="button"
      className={`w-[210px] rounded-lg border bg-card text-left shadow-sm transition-all ${
        data.selected
          ? "border-primary ring-2 ring-primary/25"
          : "border-border hover:border-primary/60 hover:shadow-md"
      } ${data.dimmed ? "opacity-35" : "opacity-100"}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2.5 !w-2.5 !border-white" style={{ backgroundColor: data.lane.color }} />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !border-white" style={{ backgroundColor: data.lane.color }} />
      <div className="rounded-t-lg px-3 py-2 text-white" style={{ backgroundColor: data.lane.color }}>
        <div className="truncate text-[13px] font-semibold">{data.activity.activity}</div>
      </div>
      <div className="space-y-2 px-3 py-2">
        <p className="line-clamp-2 min-h-[34px] text-xs leading-4 text-text-muted">{data.activity.summary}</p>
        <div className="flex flex-wrap gap-1">
          {data.activity.dataObjects.slice(0, 3).map((object) => (
            <span key={object} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              {object}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function LaneNode({ data }: NodeProps<LaneFlowNode>) {
  return (
    <div className="h-full w-full rounded-xl border border-border/70 bg-surface/55">
      <div className="flex h-full items-center gap-3 px-4">
        <div className="h-16 w-1.5 rounded-full" style={{ backgroundColor: data.lane.color }} />
        <div className="w-[190px]">
          <div className="text-sm font-semibold">{data.lane.title}</div>
          <div className="mt-1 text-[11px] leading-4 text-text-muted">{data.lane.description}</div>
        </div>
      </div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-xs text-text-muted">- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function RelationButton({ label, edgeLabel, onClick }: { label: string; edgeLabel: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded border border-border bg-card px-3 py-2 text-left text-xs hover:border-primary/60"
    >
      <span>
        <span className="font-semibold text-text">{label}</span>
        <span className="ml-2 text-text-muted">{edgeLabel}</span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 text-text-muted" />
    </button>
  );
}
