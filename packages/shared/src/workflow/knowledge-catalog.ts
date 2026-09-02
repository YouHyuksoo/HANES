import { workflowEdges, workflowNodes } from './legacy-map';
import {
  KNOWLEDGE_CATEGORIES,
  undocumentedCoverage,
  type KnowledgeCatalog,
  type KnowledgeCategory,
  type KnowledgeNode,
  type KnowledgeRelation,
  type KnowledgeRelationCategory,
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
evidenceNodes.push({
  id: 'evidence:legacy-workflow-map',
  kind: 'evidence',
  label: 'Legacy workflow map',
  source: 'packages/shared/src/workflow/legacy-map.ts',
});

const representativeNodes: KnowledgeNode[] = [
  { id: 'logic:arrival-lot-unit-quantity', kind: 'logic', label: 'LOT_UNIT_QTY 기준 MAT_LOT 발급', description: '입하 시 품목 LOT_UNIT_QTY 기준으로 MAT_LOT을 발급한다.', coverage: undocumentedCoverage() },
  { id: 'master:iqc-part-spec', kind: 'master', label: 'IQC 품목 검사 기준', description: '품목별 검사항목과 AQL 정책이다.', coverage: undocumentedCoverage() },
  { id: 'constraint:iqc-pass-before-label', kind: 'constraint', label: 'IQC PASS 후 라벨 발행', description: 'IQC PASS 입하건만 라벨 발행 대상이 된다.', coverage: undocumentedCoverage() },
  { id: 'exception:iqc-fail-defect-move', kind: 'exception', label: 'IQC FAIL 불용창고 이동', description: 'IQC FAIL 시 해당 시리얼 전량을 불용창고로 이동한다.', coverage: undocumentedCoverage() },
  { id: 'requiredTask:kitting-label-scan-confirmation', kind: 'requiredTask', label: '키팅 실물 라벨 스캔 확정', description: 'SG 라벨 발행 후 실물 라벨을 스캔해 확정한다.', coverage: undocumentedCoverage() },
  { id: 'constraint:shipping-pallet-scan', kind: 'constraint', label: '출하 전 팔레트 바코드 검증', description: 'LOADED에서 SHIPPED 전환 전 팔레트 바코드 검증이 필요하다.', coverage: undocumentedCoverage() },
];

const representativeRelations: KnowledgeRelation[] = [
  { id: 'curated:arrival-lot-logic', source: 'activity:arrival-register', target: 'logic:arrival-lot-unit-quantity', kind: 'references', category: 'logic', evidenceStatus: 'verified' },
  { id: 'curated:arrival-lot-evidence', source: 'logic:arrival-lot-unit-quantity', target: 'evidence:material', kind: 'evidencedBy', category: 'evidence', evidenceStatus: 'verified' },
  { id: 'curated:iqc-master', source: 'activity:iqc-inspection', target: 'master:iqc-part-spec', kind: 'requires', category: 'masters', evidenceStatus: 'verified' },
  { id: 'curated:iqc-master-evidence', source: 'master:iqc-part-spec', target: 'evidence:legacy-workflow-map', kind: 'evidencedBy', category: 'evidence', evidenceStatus: 'verified' },
  { id: 'curated:iqc-pass-label', source: 'constraint:iqc-pass-before-label', target: 'activity:material-label', kind: 'validates', category: 'constraints', evidenceStatus: 'verified' },
  { id: 'curated:iqc-pass-label-evidence', source: 'constraint:iqc-pass-before-label', target: 'evidence:iqc', kind: 'evidencedBy', category: 'evidence', evidenceStatus: 'verified' },
  { id: 'curated:iqc-fail', source: 'activity:iqc-inspection', target: 'exception:iqc-fail-defect-move', kind: 'raises', category: 'exceptions', evidenceStatus: 'verified' },
  { id: 'curated:iqc-fail-evidence', source: 'exception:iqc-fail-defect-move', target: 'evidence:iqc', kind: 'evidencedBy', category: 'evidence', evidenceStatus: 'verified' },
  { id: 'curated:kitting-scan', source: 'activity:subprocess-kitting', target: 'requiredTask:kitting-label-scan-confirmation', kind: 'requires', category: 'requiredTasks', evidenceStatus: 'verified' },
  { id: 'curated:kitting-scan-evidence', source: 'requiredTask:kitting-label-scan-confirmation', target: 'evidence:production', kind: 'evidencedBy', category: 'evidence', evidenceStatus: 'verified' },
  { id: 'curated:shipping-scan', source: 'constraint:shipping-pallet-scan', target: 'activity:shipping-confirm', kind: 'validates', category: 'constraints', evidenceStatus: 'verified' },
  { id: 'curated:shipping-scan-evidence', source: 'constraint:shipping-pallet-scan', target: 'evidence:shipping', kind: 'evidencedBy', category: 'evidence', evidenceStatus: 'verified' },
];

for (const [id, activity] of evidenceDefinitions) {
  convertedRelations.push({
    id: `evidence:${id}`,
    source: activity,
    target: `evidence:${id}`,
    kind: 'evidencedBy',
    category: 'evidence',
    evidenceStatus: 'verified',
  });
}

convertedRelations.push(...representativeRelations);

const nodes = [...activityNodes, ...routes.values(), ...dataObjects.values(), ...evidenceNodes, ...representativeNodes];
const nodeById = new Map(nodes.map((node) => [node.id, node]));
for (const relation of convertedRelations) {
  for (const id of [relation.source, relation.target]) {
    const coverage = nodeById.get(id)?.coverage;
    if (coverage && (KNOWLEDGE_CATEGORIES as readonly string[]).includes(relation.category)) {
      coverage[relation.category as KnowledgeCategory] = 'present';
    }
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

export const RELATION_CATEGORY_BY_KIND: Record<KnowledgeRelationKind, readonly KnowledgeRelationCategory[]> = {
  precedes: ['flow'], follows: ['flow'], requires: ['masters', 'requiredTasks'], references: ['flow', 'masters', 'requiredTasks', 'logic', 'tables'],
  validates: ['constraints'], branchesTo: ['flow', 'exceptions'], raises: ['exceptions'], recoversWith: ['exceptions'],
  reads: ['tables'], writes: ['tables'], evidencedBy: ['evidence'],
};
