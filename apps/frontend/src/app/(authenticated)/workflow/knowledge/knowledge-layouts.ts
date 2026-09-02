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

/**
 * 노드 카드 실측 크기(KnowledgeNode의 w-56 = 224px, 높이 약 96px).
 * 배치 간격은 이 값보다 넉넉해야 카드가 겹치지 않는다.
 */
const NODE_WIDTH = 224;
// 설명 문단이 붙은 카드 기준(3줄). 짧은 카드에 맞추면 긴 카드끼리 위아래가 닿는다.
const NODE_HEIGHT = 128;
/** 카드 사이 최소 여백 */
const GAP_X = 60;
const GAP_Y = 40;

/** 노드 종류 → 관계 종류. 중심과 직접 관계가 없는 노드(펼쳐진 이웃)를 분류할 때 쓴다. */
const CATEGORY_BY_NODE_KIND: Record<KnowledgeNode["kind"], KnowledgeRelationCategory> = {
  activity: "flow",
  screen: "flow",
  master: "masters",
  constraint: "constraints",
  requiredTask: "requiredTasks",
  exception: "exceptions",
  logic: "logic",
  data: "tables",
  evidence: "evidence",
};

const relationCategoryFor = (
  nodeId: string,
  centerId: string,
  relations: readonly KnowledgeRelation[],
  nodes?: readonly KnowledgeNode[],
): KnowledgeRelationCategory => {
  const direct = relations.find((relation) =>
    (relation.source === centerId && relation.target === nodeId) ||
    (relation.target === centerId && relation.source === nodeId),
  );
  if (direct) return direct.category;
  // 펼쳐서 들어온 이웃은 중심과 직접 관계가 없다. 전부 flow로 떨어뜨리면
  // 흐름 가지에 근거·데이터가 섞여 쌓이므로 노드 종류로 가른다.
  const kind = nodes?.find((node) => node.id === nodeId)?.kind;
  return kind ? CATEGORY_BY_NODE_KIND[kind] : "flow";
};

/** 마인드맵에서 왼쪽 가지로 뻗는 종류 — 투입(기준·조건·선행) */
const MINDMAP_LEFT: readonly KnowledgeRelationCategory[] = ["masters", "constraints", "requiredTasks"];
/** 오른쪽 가지 — 진행·산출(흐름·로직·데이터·예외·근거) */
const MINDMAP_RIGHT: readonly KnowledgeRelationCategory[] = ["flow", "logic", "tables", "exceptions", "evidence"];

/**
 * 마인드맵 — 중심에서 좌우로 가지가 뻗는 트리.
 *
 * 왼쪽엔 투입(기준정보·제약·선행작업), 오른쪽엔 진행·산출(흐름·로직·데이터·예외·근거)을 둔다.
 * 같은 종류는 한 가지로 묶여 세로로 쌓이고, 가지끼리는 간격을 둔다.
 * 관계 레이아웃(원형 그물)과 달리 "무엇이 들어가서 무엇이 나오는가"를 읽는 그림이다.
 */
const mindmapLayout: KnowledgeLayout = (nodes, relations, centerId) => {
  const rowGap = NODE_HEIGHT + GAP_Y;
  const branchGap = rowGap * 0.6; // 가지 사이 추가 여백
  const armLength = NODE_WIDTH + GAP_X * 2; // 중심에서 가지까지 거리

  const byCategory = new Map<KnowledgeRelationCategory, string[]>();
  for (const node of [...nodes].sort((a, b) => a.label.localeCompare(b.label, "ko"))) {
    if (node.id === centerId) continue;
    const category = relationCategoryFor(node.id, centerId, relations, nodes);
    const list = byCategory.get(category) ?? [];
    list.push(node.id);
    byCategory.set(category, list);
  }

  // 한쪽 가지들을 위에서 아래로 쌓고, 전체를 중심선 기준으로 가운데 정렬한다.
  const placeSide = (order: readonly KnowledgeRelationCategory[], direction: 1 | -1) => {
    const positions = new Map<string, { x: number; y: number }>();
    const branches = order.filter((category) => (byCategory.get(category)?.length ?? 0) > 0);
    const totalRows = branches.reduce((sum, category) => sum + (byCategory.get(category)?.length ?? 0), 0);
    const totalHeight = totalRows * rowGap + Math.max(0, branches.length - 1) * branchGap;
    let y = -totalHeight / 2 + rowGap / 2;
    for (const category of branches) {
      for (const id of byCategory.get(category) ?? []) {
        positions.set(id, { x: direction * armLength, y });
        y += rowGap;
      }
      y += branchGap;
    }
    return positions;
  };

  const placed = new Map([...placeSide(MINDMAP_LEFT, -1), ...placeSide(MINDMAP_RIGHT, 1)]);
  return nodes.map((node) => {
    if (node.id === centerId) return { ...node, position: { x: 0, y: 0 } };
    return { ...node, position: placed.get(node.id) ?? { x: armLength, y: 0 } };
  });
};

export const KNOWLEDGE_LAYOUTS: Record<LayoutMode, KnowledgeLayout> = {
  mindmap: mindmapLayout,
};

const MIN_NODE_SPACING = 1;

function isValidLayout(
  positioned: readonly PositionedKnowledgeNode[],
  nodes: readonly KnowledgeNode[],
  centerId: string,
): boolean {
  if (positioned.length !== nodes.length) return false;
  const expectedIds = new Set(nodes.map(({ id }) => id));
  const actualIds = new Set(positioned.map(({ id }) => id));
  if (expectedIds.size !== nodes.length || actualIds.size !== positioned.length) return false;
  if (!actualIds.has(centerId) || expectedIds.size !== actualIds.size) return false;
  if ([...expectedIds].some((id) => !actualIds.has(id))) return false;
  if (positioned.some(({ position }) => !Number.isFinite(position.x) || !Number.isFinite(position.y))) return false;
  const minimumDistanceSquared = MIN_NODE_SPACING * MIN_NODE_SPACING;
  for (let left = 0; left < positioned.length; left += 1) {
    for (let right = left + 1; right < positioned.length; right += 1) {
      const x = positioned[left].position.x - positioned[right].position.x;
      const y = positioned[left].position.y - positioned[right].position.y;
      if (x * x + y * y < minimumDistanceSquared) return false;
    }
  }
  return true;
}

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
    if (!isValidLayout(positioned, graph.nodes, graph.center.id)) {
      return radialFallback(graph.nodes, graph.center.id);
    }
    return positioned;
  } catch {
    return radialFallback(graph.nodes, graph.center.id);
  }
}
