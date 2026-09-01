import {
  isWorkflowKnowledgeInterpretResponse,
  workflowKnowledgeCatalog,
  type EvidenceStatus,
  type KnowledgeRelation,
} from "@harness/shared";

export interface KnowledgeInteractionState {
  centerId: string | null;
  invalidCenter: string | null;
  selectedNodeId: string | null;
  expandedNodeIds: string[];
  fitRevision: number;
}

export function selectGraphNode(state: KnowledgeInteractionState, nodeId: string): KnowledgeInteractionState {
  return {
    ...state,
    selectedNodeId: nodeId,
    expandedNodeIds: state.expandedNodeIds.includes(nodeId)
      ? state.expandedNodeIds
      : [...state.expandedNodeIds, nodeId],
  };
}

export function selectSearchResult(state: KnowledgeInteractionState, nodeId: string): KnowledgeInteractionState {
  if (state.centerId) return selectGraphNode(state, nodeId);
  return cleanCenterState(state, nodeId);
}

export function recenterKnowledge(state: KnowledgeInteractionState, centerId: string): KnowledgeInteractionState {
  return cleanCenterState(state, centerId);
}

export function restoreKnowledgeCenter(state: KnowledgeInteractionState, centerId: string | null): KnowledgeInteractionState {
  return cleanCenterState(state, centerId);
}

function cleanCenterState(state: KnowledgeInteractionState, centerId: string | null): KnowledgeInteractionState {
  return {
    ...state,
    centerId,
    invalidCenter: null,
    selectedNodeId: null,
    expandedNodeIds: [],
    fitRevision: state.fitRevision + 1,
  };
}

export function shouldInterpretKnowledgeQuery(query: string, localResultCount: number, explicit: boolean): boolean {
  return query.trim().length > 0 && (explicit || localResultCount === 0);
}

export function validateKnowledgeCandidates(value: unknown): boolean {
  return isWorkflowKnowledgeInterpretResponse(value, workflowKnowledgeCatalog);
}

export function deriveNodeEvidenceStatus(nodeId: string, relations: readonly KnowledgeRelation[]): EvidenceStatus {
  const incident = relations.filter((relation) => relation.source === nodeId || relation.target === nodeId);
  const evidenceLinks = incident.filter((relation) => relation.kind === "evidencedBy");
  const relevant = evidenceLinks.length > 0 ? evidenceLinks : incident;
  if (relevant.some((relation) => relation.evidenceStatus === "partial")) return "partial";
  if (relevant.some((relation) => relation.evidenceStatus === "verified")) return "verified";
  return "undocumented";
}

export function fitViewDuration(reducedMotion: boolean): number {
  return reducedMotion ? 0 : 280;
}
