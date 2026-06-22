"use client";

/**
 * @file src/app/(authenticated)/system/er-view/page.tsx
 * @description ER VIEW — 실시간 DB 스키마 관계/리스크/orphan 분석 도구
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { AlertTriangle, Database, GitBranch, Play, RefreshCw, Search, ShieldCheck, Trash2, Unlink } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/services/api";
import Button from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
type RelationshipType = "PHYSICAL_FK" | "INFERRED";

interface Summary {
  mode: "dev" | "prod";
  tableCount: number;
  columnCount: number;
  pkTableCount: number;
  physicalFkCount: number;
  inferredRelationshipCount: number;
}

interface TableRow {
  tableName: string;
  tableComment: string;
  module: string;
  hasPk: boolean;
  columnCount: number;
}

interface RiskScore {
  score: number;
  level: RiskLevel;
  executable: boolean;
  recommendation: string;
  reasons: Array<{ code: string; label: string; score: number }>;
}

interface Relationship {
  id: string;
  relationshipType: RelationshipType;
  constraintName?: string;
  childTable: string;
  childColumns: string[];
  parentTable: string;
  parentColumns: string[];
  parentKeyReady: boolean;
  tenantIncluded: boolean;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  orphanCount?: number;
  risk?: RiskScore;
}

interface GraphColumn {
  columnName: string;
  dataType: string;
  nullable: "Y" | "N";
  comments?: string | null;
  isPk: boolean;
  isFkCandidate: boolean;
}

interface GraphNode {
  id: string;
  label: string;
  comment: string;
  pkColumns: string[];
  columns: GraphColumn[];
}

interface GraphResponse {
  nodes: GraphNode[];
  edges: Array<{ id: string; source: string; target: string; label: string; constraintName?: string; relationshipType: RelationshipType; riskLevel: RiskLevel }>;
  relationships: Relationship[];
}

interface TableNodeData extends Record<string, unknown> {
  label: string;
  comment: string;
  columns: GraphColumn[];
  pkColumns: string[];
  selected: boolean;
  focused: boolean;
}

type TableFlowNode = Node<TableNodeData, "table">;
type ActionType = "ADD_FK" | "ADD_UK" | "DROP_FK" | "DELETE_ORPHANS";
type InferredEdgeType = "default" | "smoothstep" | "straight" | "step";

interface ActionRequest {
  actionType: ActionType;
  constraintName?: string;
  childTable?: string;
  childColumns?: string[];
  parentTable?: string;
  parentColumns?: string[];
  tableName?: string;
  columns?: string[];
}

interface ActionPreview {
  actionType: ActionType;
  sql: string;
  confirmationPhrase: string;
  expectedAffectedRows: number;
  riskLevel: RiskLevel;
  rawSqlAccepted: false;
}

const riskClass: Record<RiskLevel, string> = {
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  BLOCKED: "bg-rose-50 text-rose-700 border-rose-200",
};

const nodeTypes = { table: TableNode };
const inferredEdgeTypeOptions: Array<{ value: InferredEdgeType; label: string }> = [
  { value: "default", label: "곡선" },
  { value: "smoothstep", label: "완만한 계단" },
  { value: "step", label: "계단" },
  { value: "straight", label: "직선" },
];

export default function ErViewPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [graph, setGraph] = useState<GraphResponse | null>(null);
  const [selectedRel, setSelectedRel] = useState<Relationship | null>(null);
  const [orphanScan, setOrphanScan] = useState<any>(null);
  const [preview, setPreview] = useState<ActionPreview | null>(null);
  const [previewPayload, setPreviewPayload] = useState<ActionRequest | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [inferredEdgeType, setInferredEdgeType] = useState<InferredEdgeType>("default");
  const nodeDragRef = useRef(false);
  const primaryTable = selectedTables[0] ?? "";
  const selectedTableSet = useMemo(() => new Set(selectedTables), [selectedTables]);

  const filteredTables = useMemo(() => {
    const keyword = query.trim().toUpperCase();
    if (!keyword) return tables;
    return tables.filter((table) => `${table.tableName} ${table.tableComment} ${table.module}`.toUpperCase().includes(keyword));
  }, [query, tables]);

  const computedNodes: TableFlowNode[] = useMemo(() => {
    if (!graph) return [];
    const parentTables = new Set(
      graph.relationships
        .filter((rel) => rel.childTable === primaryTable)
        .map((rel) => rel.parentTable),
    );
    const childTables = new Set(
      graph.relationships
        .filter((rel) => rel.parentTable === primaryTable)
        .map((rel) => rel.childTable),
    );

    return graph.nodes.map((node, index) => ({
      id: node.id,
      type: "table",
      position: getTableNodePosition(node.id, primaryTable, selectedTables, parentTables, childTables, index),
      data: {
        label: node.label,
        comment: node.comment,
        columns: node.columns,
        pkColumns: node.pkColumns,
        selected: selectedTableSet.has(node.id),
        focused: node.id === primaryTable,
      },
      draggable: true,
    }));
  }, [graph, primaryTable, selectedTableSet, selectedTables]);
  const [nodes, setNodes, onNodesChange] = useNodesState<TableFlowNode>([]);

  const edges: Edge[] = useMemo(() => {
    if (!graph) return [];
    return graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: "source",
      targetHandle: "target",
      type: edge.relationshipType === "INFERRED" ? inferredEdgeType : "smoothstep",
      label: edge.relationshipType === "PHYSICAL_FK" ? `물리 FK ${edge.constraintName ?? edge.label}` : `추정 관계 ${edge.label}`,
      animated: edge.relationshipType === "INFERRED",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.relationshipType === "PHYSICAL_FK" ? "#2563eb" : "#f59e0b",
      },
      style: {
        stroke: edge.relationshipType === "PHYSICAL_FK" ? "#2563eb" : "#f59e0b",
        strokeDasharray: edge.relationshipType === "INFERRED" ? "6 4" : undefined,
      },
    }));
  }, [graph, inferredEdgeType]);

  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes, setNodes]);

  const loadBase = async () => {
    const [summaryRes, tableRes] = await Promise.all([
      api.get("/system/er-view/summary"),
      api.get("/system/er-view/tables"),
    ]);
    const summaryData = summaryRes.data?.data ?? summaryRes.data;
    const tableData = tableRes.data?.data ?? tableRes.data ?? [];
    setSummary(summaryData);
    setTables(tableData);
    const first = tableData?.[0]?.tableName;
    if (selectedTables.length === 0 && first) {
      setSelectedTables([first]);
    }
  };

  const loadGraphForTables = async (tableNames: string[]) => {
    const uniqueTables = [...new Set(tableNames)].filter(Boolean);
    if (uniqueTables.length === 0) return;
    const responses = await Promise.all(
      uniqueTables.map((table) => api.get(`/system/er-view/graph?table=${encodeURIComponent(table)}&depth=1`)),
    );
    const mergedGraph = mergeGraphResponses(responses.map((res) => res.data?.data ?? res.data));
    setGraph(mergedGraph);
    setSelectedRel((current) => (
      current ? mergedGraph.relationships.find((rel) => rel.id === current.id) ?? mergedGraph.relationships[0] ?? null : mergedGraph.relationships[0] ?? null
    ));
    setOrphanScan(null);
    setPreview(null);
    setPreviewPayload(null);
    setConfirmText("");
  };

  const focusTable = (tableName: string) => {
    setSelectedTables((current) => [tableName, ...current.filter((name) => name !== tableName)]);
  };

  const toggleTableSelection = (tableName: string) => {
    setSelectedTables((current) => {
      if (current.includes(tableName)) {
        return current.length === 1 ? current : current.filter((name) => name !== tableName);
      }
      return [tableName, ...current];
    });
  };

  useEffect(() => {
    loadBase().catch(() => toast.error("ER VIEW 데이터를 불러오지 못했습니다"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTables.length > 0) {
      loadGraphForTables(selectedTables).catch(() => toast.error("ER VIEW 그래프를 불러오지 못했습니다"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTables]);

  const scanOrphans = async () => {
    if (!selectedRel) return;
    setLoading(true);
    try {
      const res = await api.post("/system/er-view/relationships/scan-orphans", {
        childTable: selectedRel.childTable,
        childColumns: selectedRel.childColumns,
        parentTable: selectedRel.parentTable,
        parentColumns: selectedRel.parentColumns,
        sampleLimit: 20,
      }, { skipSuccessToast: true });
      setOrphanScan(res.data?.data ?? res.data);
    } finally {
      setLoading(false);
    }
  };

  const dryRun = async (actionType: ActionType) => {
    if (!selectedRel) return;
    setLoading(true);
    try {
      const payload = buildActionPayload(actionType, selectedRel);
      const res = await api.post("/system/er-view/actions/dry-run", payload, { skipSuccessToast: true });
      setPreview(res.data?.data ?? res.data);
      setPreviewPayload(payload);
      setConfirmText("");
    } finally {
      setLoading(false);
    }
  };

  const execute = async () => {
    if (!selectedRel || !preview || !previewPayload) return;
    setLoading(true);
    try {
      await api.post("/system/er-view/actions/execute", {
        ...previewPayload,
        confirmationPhrase: confirmText,
      });
      toast.success("ER VIEW 실행이 완료되었습니다");
      await loadGraphForTables(selectedTables);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col bg-background text-text">
      <header className="shrink-0 px-4 py-3 border-b border-border bg-surface flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">ER VIEW</h1>
            <p className="text-xs text-text-muted">실시간 DB 스키마, 물리 FK, 추정 관계, orphan, ENABLE VALIDATE 실행 관리</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-1 rounded border border-border bg-card">MODE {summary?.mode?.toUpperCase() ?? "DEV"}</span>
          <Button size="sm" variant="secondary" leftIcon={<RefreshCw className="w-4 h-4" />} onClick={loadBase}>새로고침</Button>
        </div>
      </header>

      <div className="grid grid-cols-[300px_minmax(420px,1fr)_420px] flex-1 min-h-0 overflow-hidden">
        <aside data-er-view-panel="table-list" className="border-r border-border bg-card min-h-0 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Metric label="Tables" value={summary?.tableCount ?? 0} />
              <Metric label="Columns" value={summary?.columnCount ?? 0} />
              <Metric label="물리 FK" value={summary?.physicalFkCount ?? 0} />
              <Metric label="추정 관계" value={summary?.inferredRelationshipCount ?? 0} />
            </div>
            <label className="relative block">
              <Search className="absolute left-2 top-2.5 w-4 h-4 text-text-muted" />
              <input
                className="w-full h-9 pl-8 pr-2 rounded border border-border bg-background text-sm"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="테이블/모듈 검색"
              />
            </label>
            <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
              <span data-er-view-selected-count="true">선택 {selectedTables.length}개</span>
              <span className="font-mono truncate">포커스 {primaryTable || "-"}</span>
            </div>
          </div>
          <div className="overflow-auto min-h-0">
            {filteredTables.map((table) => (
              <label
                key={table.tableName}
                className={`flex w-full cursor-pointer items-start gap-2 px-3 py-2 text-left border-b border-border hover:bg-primary/5 ${selectedTableSet.has(table.tableName) ? "bg-primary/10" : ""}`}
              >
                <input
                  data-er-view-table-checkbox="true"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-border"
                  checked={selectedTableSet.has(table.tableName)}
                  onChange={() => toggleTableSelection(table.tableName)}
                />
                <div className="min-w-0 flex-1" onDoubleClick={() => focusTable(table.tableName)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-mono text-xs font-semibold">{table.tableName}</span>
                    <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${table.hasPk ? "border-emerald-200 text-emerald-700" : "border-rose-200 text-rose-700"}`}>PK</span>
                  </div>
                  <div className="mt-1 text-[11px] text-text-muted truncate">{table.module} · {table.columnCount} cols · {table.tableComment || "-"}</div>
                </div>
              </label>
            ))}
          </div>
        </aside>

        <main data-er-view-panel="graph" className="min-h-0 overflow-hidden flex flex-col">
          <div className="shrink-0 px-3 py-2 border-b border-border bg-surface flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="w-4 h-4" />
              <span className="font-semibold">{primaryTable || "테이블 선택"}</span>
              <span className="text-text-muted">{selectedTables.length}개 테이블 1-hop 관계 그래프</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1"><span className="w-6 h-0.5 bg-blue-600" /> 물리 FK</span>
              <span className="inline-flex items-center gap-1"><span className="w-6 h-0.5 border-t border-dashed border-amber-500" /> 추정 관계</span>
              <label className="inline-flex items-center gap-1">
                <span className="text-text-muted">추정선</span>
                <select
                  data-er-view-inferred-edge-type="true"
                  className="h-7 rounded border border-border bg-background px-2 text-xs"
                  value={inferredEdgeType}
                  onChange={(event) => setInferredEdgeType(event.target.value as InferredEdgeType)}
                >
                  {inferredEdgeTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div data-er-view-canvas="true" className="flex-1 min-h-0 overflow-hidden">
            <ReactFlow
              className="h-full w-full"
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              fitView
              fitViewOptions={{ padding: 0.28, includeHiddenNodes: false }}
              minZoom={0.05}
              maxZoom={2.5}
              nodesDraggable
              elementsSelectable
              nodesConnectable={false}
              panOnDrag
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick
              onEdgeClick={(_, edge) => setSelectedRel(graph?.relationships.find((rel) => rel.id === edge.id) ?? null)}
              onNodeDragStart={() => {
                nodeDragRef.current = true;
              }}
              onNodeDragStop={() => {
                window.setTimeout(() => {
                  nodeDragRef.current = false;
                }, 0);
              }}
              onNodeClick={(_, node) => {
                if (nodeDragRef.current) return;
                focusTable(node.id);
              }}
            >
              <Background gap={18} />
              <Controls position="top-right" showInteractive={false} />
              <MiniMap pannable zoomable />
            </ReactFlow>
          </div>
        </main>

        <aside data-er-view-panel="detail" className="border-l border-border bg-card min-h-0 overflow-auto p-3">
          {!selectedRel ? (
            <div className="text-sm text-text-muted">관계를 선택하세요.</div>
          ) : (
            <div className="space-y-3">
              {selectedRel.relationshipType === "PHYSICAL_FK" && (
                <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  이미 물리 FK가 존재하는 관계입니다. 현재 FK명은 <span className="font-mono font-semibold">{selectedRel.constraintName ?? "-"}</span> 입니다.
                </div>
              )}
              {!selectedRel.parentKeyReady && (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  부모 PK/UK가 없어 FK를 바로 생성할 수 없습니다. 먼저 부모 UK 후보를 검토한 뒤 orphan을 정리하고 FK를 생성하세요.
                </div>
              )}
              <Card padding="sm" className="rounded-lg">
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{selectedRel.relationshipType === "PHYSICAL_FK" ? "물리 FK" : "추정 관계"}</span>
                    <span className={`text-xs border px-2 py-1 rounded ${riskClass[selectedRel.risk?.level ?? "MEDIUM"]}`}>{selectedRel.risk?.level ?? "MEDIUM"}</span>
                  </div>
                  <div className="font-mono text-xs break-all">{selectedRel.childTable}.{selectedRel.childColumns.join(", ")} → {selectedRel.parentTable}.{selectedRel.parentColumns.join(", ")}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Badge
                      label={selectedRel.relationshipType === "PHYSICAL_FK" ? "현재 FK명" : "FK 후보명"}
                      value={selectedRel.relationshipType === "PHYSICAL_FK"
                        ? selectedRel.constraintName ?? "-"
                        : buildConstraintName("FK", selectedRel.childTable, selectedRel.parentColumns)}
                    />
                    <Badge label="상태" value={selectedRel.risk?.recommendation ?? "-"} />
                    <Badge label="부모 PK/UK" value={selectedRel.parentKeyReady ? "있음" : "없음"} />
                    <Badge label="테넌트 포함" value={selectedRel.tenantIncluded ? "예" : "아니오"} />
                    <Badge label="신뢰도" value={selectedRel.confidence} />
                    <Badge label="orphan" value={orphanScan ? `${orphanScan.orphanCount}건` : "미검사"} />
                  </div>
                </CardContent>
              </Card>

              <Card padding="sm" className="rounded-lg">
                <CardContent className="space-y-2">
                  <div className="font-semibold text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />상태/리스크 근거</div>
                  {(selectedRel.risk?.reasons ?? []).map((reason) => (
                    <div key={reason.code} className="flex items-center justify-between text-xs border-b border-border py-1">
                      <span>{reason.label}</span>
                      {reason.score > 0 && <span className="font-mono">+{reason.score}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="secondary" isLoading={loading} onClick={scanOrphans}>orphan 검사</Button>
                {!selectedRel.parentKeyReady && (
                  <Button size="sm" variant="outline" isLoading={loading} onClick={() => dryRun("ADD_UK")} leftIcon={<ShieldCheck className="w-4 h-4" />}>부모 UK 후보</Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  isLoading={loading}
                  disabled={selectedRel.relationshipType === "PHYSICAL_FK" || !selectedRel.parentKeyReady || Number(orphanScan?.orphanCount ?? 0) > 0}
                  onClick={() => dryRun("ADD_FK")}
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                >
                  {selectedRel.relationshipType === "PHYSICAL_FK" ? "이미 물리 FK" : "FK DDL 후보"}
                </Button>
                {selectedRel.relationshipType === "PHYSICAL_FK" && (
                  <Button
                    size="sm"
                    variant="danger"
                    isLoading={loading}
                    onClick={() => dryRun("DROP_FK")}
                    leftIcon={<Unlink className="w-4 h-4" />}
                  >
                    FK 제거 후보
                  </Button>
                )}
                <Button size="sm" variant="danger" isLoading={loading} onClick={() => dryRun("DELETE_ORPHANS")} leftIcon={<Trash2 className="w-4 h-4" />}>orphan 삭제 후보</Button>
              </div>

              {orphanScan && (
                <Card padding="sm" className="rounded-lg">
                  <CardContent>
                    <div className="text-sm font-semibold mb-2">orphan scan 결과</div>
                    <div className="text-xs mb-2">count: <span className="font-mono">{orphanScan.orphanCount}</span></div>
                    <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-auto max-h-32">{orphanScan.sql}</pre>
                  </CardContent>
                </Card>
              )}

              {preview && (
                <Card padding="sm" className="rounded-lg">
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">실행 SQL 전체</span>
                      <span className="text-xs font-mono">ENABLE VALIDATE</span>
                    </div>
                    <pre className="text-[11px] bg-background border border-border rounded p-2 overflow-auto max-h-48">{preview.sql}</pre>
                    <label className="block text-xs">
                      확인 문구
                      <input
                        className="mt-1 w-full h-9 rounded border border-border bg-background px-2 font-mono"
                        value={confirmText}
                        onChange={(event) => setConfirmText(event.target.value)}
                        placeholder={preview.confirmationPhrase}
                      />
                    </label>
                    <Button
                      size="sm"
                      variant="primary"
                      isLoading={loading}
                      disabled={confirmText !== preview.confirmationPhrase}
                      onClick={execute}
                      leftIcon={<Play className="w-4 h-4" />}
                    >
                      실행
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function getTableNodePosition(
  tableName: string,
  primaryTable: string,
  selectedTables: string[],
  parentTables: Set<string>,
  childTables: Set<string>,
  fallbackIndex: number,
) {
  if (tableName === primaryTable) return { x: 360, y: 180 };
  if (selectedTables.includes(tableName)) {
    const index = selectedTables.indexOf(tableName);
    return { x: 360, y: 40 + index * 250 };
  }
  if (childTables.has(tableName)) {
    const index = [...childTables].indexOf(tableName);
    return { x: 0, y: 40 + index * 250 };
  }
  if (parentTables.has(tableName)) {
    const index = [...parentTables].indexOf(tableName);
    return { x: 740, y: 40 + index * 250 };
  }
  return { x: 360, y: 40 + fallbackIndex * 250 };
}

function mergeGraphResponses(graphs: GraphResponse[]): GraphResponse {
  const nodeMap = new Map<string, GraphNode>();
  const edgeMap = new Map<string, GraphResponse["edges"][number]>();
  const relationshipMap = new Map<string, Relationship>();

  for (const graph of graphs) {
    for (const node of graph.nodes ?? []) {
      if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
    }
    for (const edge of graph.edges ?? []) {
      if (!edgeMap.has(edge.id)) edgeMap.set(edge.id, edge);
    }
    for (const relationship of graph.relationships ?? []) {
      if (!relationshipMap.has(relationship.id)) relationshipMap.set(relationship.id, relationship);
    }
  }

  return {
    nodes: [...nodeMap.values()],
    edges: [...edgeMap.values()],
    relationships: [...relationshipMap.values()],
  };
}

function buildActionPayload(actionType: ActionType, selectedRel: Relationship): ActionRequest {
  if (actionType === "ADD_UK") {
    return {
      actionType,
      constraintName: buildConstraintName("UK", selectedRel.parentTable, selectedRel.parentColumns),
      tableName: selectedRel.parentTable,
      columns: selectedRel.parentColumns,
    };
  }
  if (actionType === "DROP_FK") {
    return {
      actionType,
      constraintName: selectedRel.constraintName,
      childTable: selectedRel.childTable,
    };
  }

  return {
    actionType,
    constraintName: actionType === "ADD_FK" ? buildConstraintName("FK", selectedRel.childTable, selectedRel.parentColumns) : undefined,
    childTable: selectedRel.childTable,
    childColumns: selectedRel.childColumns,
    parentTable: selectedRel.parentTable,
    parentColumns: selectedRel.parentColumns,
  };
}

function buildConstraintName(prefix: "FK" | "UK", tableName: string, columns: string[]) {
  const terminalColumn = columns.at(-1) ?? "COL";
  return `${prefix}_${tableName.slice(0, 12)}_${terminalColumn.slice(0, 12)}`.replace(/[^A-Z0-9_]/g, "").slice(0, 30);
}

function TableNode({ data }: NodeProps<TableFlowNode>) {
  return (
    <div
      data-er-view-node="table"
      className={`w-[320px] overflow-hidden rounded border bg-card text-xs shadow-sm ${
        data.focused
          ? "border-primary ring-2 ring-primary/20"
          : data.selected
            ? "border-emerald-400 ring-1 ring-emerald-200"
            : "border-border"
      }`}
    >
      <Handle type="target" position={Position.Left} id="target" className="!h-3 !w-3 !border !border-white !bg-blue-600" />
      <Handle type="source" position={Position.Right} id="source" className="!h-3 !w-3 !border !border-white !bg-blue-600" />
      <div className="border-b border-border bg-surface px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-[13px] font-semibold">{data.label}</span>
          <span className="shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-text-muted">
            {data.pkColumns.length ? "PK" : "NO PK"}
          </span>
        </div>
        {data.comment && <div className="mt-0.5 truncate text-[11px] text-text-muted">{data.comment}</div>}
      </div>
      <div data-er-view-node-columns="true" className="max-h-[310px] overflow-y-auto overscroll-contain">
        {data.columns.map((column) => (
          <div key={column.columnName} className="grid grid-cols-[58px_minmax(0,1fr)_92px_24px] items-center gap-1 border-b border-border/70 px-2 py-1.5">
            <div className="flex gap-1">
              {column.isPk && <span className="rounded bg-blue-50 px-1 text-[10px] font-semibold text-blue-700">PK</span>}
              {column.isFkCandidate && <span className="rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-700">FK</span>}
            </div>
            <span className="truncate font-mono text-[11px]">{column.columnName}</span>
            <span className="truncate text-[10px] text-text-muted">{column.dataType}</span>
            <span className="text-right text-[10px] text-text-muted">{column.nullable}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-background px-2 py-1.5">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div className="text-sm font-semibold font-mono">{value}</div>
    </div>
  );
}

function Badge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background px-2 py-1">
      <div className="text-[10px] text-text-muted">{label}</div>
      <div className="font-mono text-[11px] break-all">{value}</div>
    </div>
  );
}
