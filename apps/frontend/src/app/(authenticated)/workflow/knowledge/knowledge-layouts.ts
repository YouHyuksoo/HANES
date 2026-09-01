import type {
  KnowledgeNeighborhood,
  KnowledgeNode,
  KnowledgeRelation,
  KnowledgeRelationCategory,
} from "@harness/shared";
import type { LayoutMode } from "./knowledge-state";

export interface PositionedKnowledgeNode extends KnowledgeNode {
  position: { x: number; y: number };
}

export type KnowledgeLayout = (
  nodes: readonly KnowledgeNode[],
  relations: readonly KnowledgeRelation[],
  centerId: string,
) => PositionedKnowledgeNode[];

export const CATEGORY_SECTORS: Record<KnowledgeRelationCategory, number> = {
  flow: 0,
  masters: -135,
  constraints: -90,
  requiredTasks: -45,
  exceptions: 90,
  logic: 135,
  tables: 180,
  evidence: 45,
};

const relationCategoryFor = (nodeId: string, centerId: string, relations: readonly KnowledgeRelation[]) =>
  relations.find((relation) =>
    (relation.source === centerId && relation.target === nodeId) ||
    (relation.target === centerId && relation.source === nodeId),
  )?.category ?? "flow";

const mindmapLayout: KnowledgeLayout = (nodes, relations, centerId) => {
  const counts = new Map<KnowledgeRelationCategory, number>();
  return nodes.map((node) => {
    if (node.id === centerId) return { ...node, position: { x: 0, y: 0 } };
    const category = relationCategoryFor(node.id, centerId, relations);
    const depth = (counts.get(category) ?? 0) + 1;
    counts.set(category, depth);
    const angle = (CATEGORY_SECTORS[category] * Math.PI) / 180;
    const radius = 220 + (depth - 1) * 90;
    return { ...node, position: { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius } };
  });
};

const processLayout: KnowledgeLayout = (nodes, relations, centerId) => {
  const columnCounts = new Map<number, number>();
  const columnFor = (id: string): number => {
    if (id === centerId) return 0;
    const relation = relations.find((item) => item.source === id || item.target === id);
    if (!relation) return 0;
    if (["precedes", "requires"].includes(relation.kind) && relation.target === centerId) return -1;
    if (["follows", "precedes", "branchesTo"].includes(relation.kind) && relation.source === centerId) return 1;
    if (relation.category === "requiredTasks" || relation.category === "masters") return -1;
    if (relation.category === "exceptions" || relation.kind === "recoversWith") return 0;
    return 1;
  };
  return nodes.map((node) => {
    const column = columnFor(node.id);
    const index = columnCounts.get(column) ?? 0;
    columnCounts.set(column, index + 1);
    const exceptional = relations.some((relation) =>
      (relation.source === node.id || relation.target === node.id) &&
      (relation.category === "exceptions" || relation.kind === "recoversWith"),
    );
    return { ...node, position: { x: column * 340, y: node.id === centerId ? 0 : exceptional ? 280 + index * 90 : (index - 1) * 130 } };
  });
};

const relationLayout: KnowledgeLayout = (nodes, relations, centerId) => {
  const counters = new Map<string, number>();
  return nodes.map((node) => {
    if (node.id === centerId) return { ...node, position: { x: 0, y: 0 } };
    const category = relationCategoryFor(node.id, centerId, relations);
    const axis = category === "flow" ? "flow" : ["masters", "constraints", "requiredTasks"].includes(category) ? "upper" : "lower";
    const index = counters.get(axis) ?? 0;
    counters.set(axis, index + 1);
    if (axis === "flow") return { ...node, position: { x: (index + 1) * 300, y: 0 } };
    return { ...node, position: { x: (index - 1) * 260, y: axis === "upper" ? -240 : 240 } };
  });
};

export const KNOWLEDGE_LAYOUTS: Record<LayoutMode, KnowledgeLayout> = {
  mindmap: mindmapLayout,
  process: processLayout,
  relation: relationLayout,
};

export function radialFallback(nodes: readonly KnowledgeNode[], centerId: string): PositionedKnowledgeNode[] {
  const others = nodes.filter((node) => node.id !== centerId);
  const count = Math.max(others.length, 1);
  let radialIndex = 0;
  return nodes.map((node) => {
    if (node.id === centerId) return { ...node, position: { x: 0, y: 0 } };
    const angle = (radialIndex++ * 2 * Math.PI) / count;
    return { ...node, position: { x: Math.cos(angle) * 240, y: Math.sin(angle) * 240 } };
  });
}

export function safeLayout(
  layout: KnowledgeLayout,
  graph: KnowledgeNeighborhood,
): PositionedKnowledgeNode[] {
  try {
    const positioned = layout(graph.nodes, graph.relations, graph.center.id);
    if (positioned.length !== graph.nodes.length || positioned.some(({ position }) =>
      !Number.isFinite(position.x) || !Number.isFinite(position.y))) {
      return radialFallback(graph.nodes, graph.center.id);
    }
    return positioned;
  } catch {
    return radialFallback(graph.nodes, graph.center.id);
  }
}
