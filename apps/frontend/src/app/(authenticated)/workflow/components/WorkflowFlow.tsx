"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Eye, EyeOff, Filter } from "lucide-react";
import {
  workflowEdges,
  workflowLanes,
  workflowNodes,
  getVisibleNodeIds,
  type WorkflowActivityNode,
  type WorkflowLane,
  type WorkflowLaneId,
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

const laneById = new Map(workflowLanes.map((l) => [l.id, l]));
const nodeTypes = { activity: ActivityNode, lane: LaneNode };

export default function WorkflowFlow({
  selectedNodeId,
  onSelect,
  query,
}: {
  selectedNodeId: string;
  onSelect: (id: string) => void;
  query: string;
}) {
  const { t } = useTranslation();
  const [activeLaneIds, setActiveLaneIds] = useState<Set<WorkflowLaneId>>(
    () => new Set(workflowLanes.map((l) => l.id)),
  );
  const [showAllRelations, setShowAllRelations] = useState(false);

  const visibleIds = useMemo(() => getVisibleNodeIds(query, activeLaneIds), [query, activeLaneIds]);

  const flowNodes: WorkflowFlowNode[] = useMemo(() => {
    const lanes: LaneFlowNode[] = workflowLanes.map((lane) => ({
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
    const acts: ActivityFlowNode[] = workflowNodes.map((activity) => {
      const lane = laneById.get(activity.lane)!;
      const visible = visibleIds.has(activity.id);
      return {
        id: activity.id,
        type: "activity",
        position: { x: activity.x, y: lane.y },
        data: { activity, lane, selected: activity.id === selectedNodeId, dimmed: !visible },
        hidden: !visible,
        draggable: false,
      };
    });
    return [...lanes, ...acts];
  }, [selectedNodeId, visibleIds]);

  const flowEdges: Edge[] = useMemo(() => {
    return workflowEdges
      .filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target))
      .filter((e) => {
        if (e.kind === "normal" || e.kind === "branch") return true;
        return showAllRelations || e.source === selectedNodeId || e.target === selectedNodeId;
      })
      .map((edge) => {
        const isReversal = edge.kind === "reversal";
        const isReference = edge.kind === "reference";
        const isFocused = edge.source === selectedNodeId || edge.target === selectedNodeId;
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
          labelStyle: { fill: "#334155", fontSize: 11, fontWeight: 600 },
          labelBgStyle: { fill: "#ffffff", fillOpacity: 0.88 },
        } satisfies Edge;
      });
  }, [selectedNodeId, showAllRelations, visibleIds]);

  const toggleLane = (laneId: WorkflowLaneId) =>
    setActiveLaneIds((cur) => {
      const next = new Set(cur);
      if (next.has(laneId) && next.size > 1) next.delete(laneId);
      else next.add(laneId);
      return next;
    });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2">
        <span className="inline-flex items-center gap-1 px-1 text-xs text-text-muted">
          <Filter className="h-3.5 w-3.5" />
          {t("workflowGuide.lane", "레인")}
        </span>
        <div className="flex items-center gap-1 overflow-x-auto">
          {workflowLanes.map((lane) => {
            const active = activeLaneIds.has(lane.id);
            return (
              <button
                key={lane.id}
                type="button"
                onClick={() => toggleLane(lane.id)}
                className={`h-8 shrink-0 rounded border px-2.5 text-xs font-semibold transition-colors ${
                  active ? "border-transparent text-white" : "border-border bg-card text-text-muted hover:bg-muted"
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
          onClick={() => setShowAllRelations((v) => !v)}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-border bg-card px-2.5 text-xs font-semibold text-text-muted hover:bg-muted"
        >
          {showAllRelations ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {showAllRelations ? t("workflowGuide.hideRelations", "보조 연결 숨김") : t("workflowGuide.showRelations", "보조 연결 보기")}
        </button>
      </div>
      <div className="min-h-0 flex-1">
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
            if (node.type === "activity") onSelect(node.id);
          }}
        >
          <Background gap={28} />
          <Controls position="top-right" showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

function ActivityNode({ data }: NodeProps<ActivityFlowNode>) {
  return (
    <button
      type="button"
      className={`w-[210px] rounded-lg border bg-card text-left shadow-sm transition-all ${
        data.selected ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/60 hover:shadow-md"
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
