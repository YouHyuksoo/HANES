export const KNOWLEDGE_CATEGORIES = [
  'flow', 'masters', 'constraints', 'requiredTasks', 'exceptions', 'logic', 'tables',
] as const;

export const COVERAGE_STATUSES = ['present', 'none', 'undocumented'] as const;
export const EVIDENCE_STATUSES = ['verified', 'partial', 'undocumented'] as const;
export const KNOWLEDGE_NODE_KINDS = [
  'activity', 'screen', 'master', 'constraint', 'requiredTask',
  'exception', 'logic', 'data', 'evidence',
] as const;
export const KNOWLEDGE_RELATION_KINDS = [
  'precedes', 'follows', 'requires', 'references', 'validates',
  'branchesTo', 'raises', 'recoversWith', 'reads', 'writes', 'evidencedBy',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type KnowledgeRelationCategory = KnowledgeCategory | 'evidence';
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export type KnowledgeNodeKind = (typeof KNOWLEDGE_NODE_KINDS)[number];
export type KnowledgeRelationKind = (typeof KNOWLEDGE_RELATION_KINDS)[number];

export type KnowledgeCoverage = Record<KnowledgeCategory, CoverageStatus>;

export interface KnowledgeNode {
  id: string;
  kind: KnowledgeNodeKind;
  label: string;
  description?: string;
  aliases?: string[];
  path?: string;
  source?: string;
  api?: string;
  coverage?: KnowledgeCoverage;
}

export interface KnowledgeRelation {
  id: string;
  source: string;
  target: string;
  kind: KnowledgeRelationKind;
  category: KnowledgeRelationCategory;
  label?: string;
  evidenceStatus: EvidenceStatus;
  cycle?: 'recovery' | 'rework';
}

export interface KnowledgeCatalog {
  nodes: KnowledgeNode[];
  relations: KnowledgeRelation[];
}

export interface KnowledgeSearchResult {
  node: KnowledgeNode;
  score: number;
}

export interface KnowledgeNeighborhood {
  center: KnowledgeNode;
  nodes: KnowledgeNode[];
  relations: KnowledgeRelation[];
}

export function undocumentedCoverage(): KnowledgeCoverage {
  return Object.fromEntries(KNOWLEDGE_CATEGORIES.map((category) => [category, 'undocumented'])) as KnowledgeCoverage;
}
