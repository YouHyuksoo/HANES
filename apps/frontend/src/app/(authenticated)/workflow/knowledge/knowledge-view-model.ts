import type {
  KnowledgeNeighborhood,
  KnowledgeRelationCategory,
} from "@harness/shared";
import type { Edge, Node } from "@xyflow/react";
import type { PositionedKnowledgeNode } from "./knowledge-layouts";
import type { ViewMode } from "./knowledge-state";

export interface KnowledgeNodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  kind: PositionedKnowledgeNode["kind"];
  emphasis: "full" | "normal" | "muted";
  opacity: number;
  labelDensity: "full" | "compact";
}

export interface KnowledgeEdgeData extends Record<string, unknown> {
  category: KnowledgeRelationCategory;
  kind: KnowledgeNeighborhood["relations"][number]["kind"];
  opacity: number;
}

export interface KnowledgeViewModelOptions {
  centerId: string;
  selectedNodeId?: string | null;
  viewMode: ViewMode;
  relationCategories: readonly KnowledgeRelationCategory[];
}

export interface KnowledgeViewModel {
  nodes: Node<KnowledgeNodeData>[];
  edges: Edge<KnowledgeEdgeData>[];
}

export function createKnowledgeViewModel(
  graph: KnowledgeNeighborhood,
  positionedNodes: readonly PositionedKnowledgeNode[],
  options: KnowledgeViewModelOptions,
): KnowledgeViewModel {
  const allowed = new Set(options.relationCategories);
  const visibleRelations = graph.relations.filter((relation) => allowed.has(relation.category));
  const nodeIdsWithVisibleRelations = new Set<string>([options.centerId]);
  for (const relation of visibleRelations) {
    nodeIdsWithVisibleRelations.add(relation.source);
    nodeIdsWithVisibleRelations.add(relation.target);
  }

  const nodes = positionedNodes
    .filter((node) => nodeIdsWithVisibleRelations.has(node.id))
    .map<Node<KnowledgeNodeData>>((node) => {
      const full = node.id === options.centerId || node.id === options.selectedNodeId;
      const modeRelevant = options.viewMode === "business"
        ? ["activity", "screen", "master", "requiredTask", "exception"].includes(node.kind)
        : ["logic", "data", "evidence", "constraint"].includes(node.kind);
      return {
        id: node.id,
        position: node.position,
        type: "knowledge",
        data: {
          label: node.label,
          description: node.description,
          kind: node.kind,
          emphasis: full ? "full" : modeRelevant ? "normal" : "muted",
          opacity: full ? 1 : modeRelevant ? 0.9 : 0.45,
          labelDensity: full || modeRelevant ? "full" : "compact",
        },
      };
    });

  const edges = visibleRelations.map<Edge<KnowledgeEdgeData>>((relation) => ({
    id: relation.id,
    source: relation.source,
    target: relation.target,
    label: relation.label,
    data: {
      category: relation.category,
      kind: relation.kind,
      opacity: options.viewMode === "technical" && ["logic", "tables", "evidence"].includes(relation.category) ? 1 : 0.75,
    },
  }));

  return { nodes, edges };
}
