export const KNOWLEDGE_CATEGORIES = [
  'flow', 'masters', 'constraints', 'requiredTasks', 'exceptions', 'logic', 'tables',
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];
export type CoverageStatus = 'present' | 'none' | 'undocumented';
export type EvidenceStatus = 'verified' | 'partial' | 'undocumented';
export type KnowledgeNodeKind =
  | 'activity' | 'screen' | 'master' | 'constraint' | 'requiredTask'
  | 'exception' | 'logic' | 'data' | 'evidence';
export type KnowledgeRelationKind =
  | 'precedes' | 'follows' | 'requires' | 'references' | 'validates'
  | 'branchesTo' | 'raises' | 'recoversWith' | 'reads' | 'writes' | 'evidencedBy';

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
  category: KnowledgeCategory;
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
