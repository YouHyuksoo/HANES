import { workflowEdges, workflowNodes } from './legacy-map';
import {
  KNOWLEDGE_CATEGORIES,
  undocumentedCoverage,
  type KnowledgeCatalog,
  type KnowledgeCategory,
  type KnowledgeNode,
  type KnowledgeRelation,
  type KnowledgeRelationKind,
} from './knowledge-types';

const activityNodes: KnowledgeNode[] = workflowNodes.map((legacy) => ({
  id: `activity:${legacy.id}`,
  kind: 'activity',
  label: legacy.activity,
  description: legacy.detail,
  aliases: [legacy.id, legacy.summary, ...legacy.inputs, ...legacy.outputs],
  coverage: undocumentedCoverage(),
}));

const routes = new Map<string, KnowledgeNode>();
const dataObjects = new Map<string, KnowledgeNode>();
const convertedRelations: KnowledgeRelation[] = [];

for (const legacy of workflowNodes) {
  for (const route of legacy.routes) {
    const id = `screen:${route.path}`;
    if (!routes.has(id)) {
      routes.set(id, { id, kind: 'screen', label: route.label, path: route.path, aliases: [route.path], coverage: undocumentedCoverage() });
    }
    convertedRelations.push({
      id: `route:${legacy.id}:${route.path}`,
      source: `activity:${legacy.id}`,
      target: id,
      kind: 'references',
      category: 'requiredTasks',
      evidenceStatus: 'verified',
    });
  }
  for (const object of legacy.dataObjects) {
    const id = `data:${object}`;
    if (!dataObjects.has(id)) {
      dataObjects.set(id, { id, kind: 'data', label: object, aliases: [object], coverage: undocumentedCoverage() });
    }
    convertedRelations.push({
      id: `data:${legacy.id}:${object}`,
      source: `activity:${legacy.id}`,
      target: id,
      kind: 'references',
      category: 'tables',
      evidenceStatus: 'partial',
    });
  }
}

const edgeKind: Record<(typeof workflowEdges)[number]['kind'], KnowledgeRelationKind> = {
  normal: 'precedes',
  branch: 'branchesTo',
  reversal: 'recoversWith',
  reference: 'references',
};

for (const edge of workflowEdges) {
  convertedRelations.push({
    id: `flow:${edge.id}`,
    source: `activity:${edge.source}`,
    target: `activity:${edge.target}`,
    kind: edgeKind[edge.kind],
    category: edge.kind === 'reversal' ? 'exceptions' : 'flow',
    label: edge.label,
    evidenceStatus: 'verified',
  });
}

const evidenceDefinitions = [
  ['material', 'activity:arrival-register', 'docs/workflows/definitions/material-flow.md'],
  ['iqc', 'activity:iqc-inspection', 'docs/workflows/definitions/material-flow.md'],
  ['production', 'activity:production-result', 'docs/workflows/definitions/production-flow.md'],
  ['shipping', 'activity:shipping-confirm', 'docs/workflows/definitions/shipping-flow.md'],
] as const;

const evidenceNodes: KnowledgeNode[] = evidenceDefinitions.map(([id, , source]) => ({
  id: `evidence:${id}`,
  kind: 'evidence',
  label: `${id} workflow definition`,
  source,
}));

for (const [id, activity] of evidenceDefinitions) {
  convertedRelations.push({
    id: `evidence:${id}`,
    source: activity,
    target: `evidence:${id}`,
    kind: 'evidencedBy',
    category: 'logic',
    evidenceStatus: 'verified',
  });
}

const nodes = [...activityNodes, ...routes.values(), ...dataObjects.values(), ...evidenceNodes];
const nodeById = new Map(nodes.map((node) => [node.id, node]));
for (const relation of convertedRelations) {
  for (const id of [relation.source, relation.target]) {
    const coverage = nodeById.get(id)?.coverage;
    if (coverage) coverage[relation.category] = 'present';
  }
}

// Unknown categories remain explicitly undocumented. No category is marked none
// unless the curated source establishes that it is conclusively inapplicable.
for (const node of nodes) {
  if (node.coverage) {
    for (const category of KNOWLEDGE_CATEGORIES) node.coverage[category] ??= 'undocumented';
  }
}

export const workflowKnowledgeCatalog: KnowledgeCatalog = {
  nodes,
  relations: convertedRelations,
};

export const RELATION_CATEGORY_BY_KIND: Record<KnowledgeRelationKind, readonly KnowledgeCategory[]> = {
  precedes: ['flow'], follows: ['flow'], requires: ['masters', 'requiredTasks'], references: ['flow', 'masters', 'requiredTasks', 'tables'],
  validates: ['constraints'], branchesTo: ['flow', 'exceptions'], raises: ['exceptions'], recoversWith: ['exceptions'],
  reads: ['tables'], writes: ['tables'], evidencedBy: ['logic'],
};
