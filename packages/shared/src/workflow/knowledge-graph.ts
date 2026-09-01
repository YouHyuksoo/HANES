import { RELATION_CATEGORY_BY_KIND, workflowKnowledgeCatalog } from './knowledge-catalog';
import {
  COVERAGE_STATUSES,
  EVIDENCE_STATUSES,
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_NODE_KINDS,
  KNOWLEDGE_RELATION_KINDS,
  type CoverageStatus,
  type KnowledgeCatalog,
  type KnowledgeCategory,
  type KnowledgeNeighborhood,
  type KnowledgeNode,
  type KnowledgeSearchResult,
} from './knowledge-types';
import { workflowNodes } from './legacy-map';

const normalize = (value: string) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function searchKnowledge(query: string, catalog: KnowledgeCatalog = workflowKnowledgeCatalog): KnowledgeSearchResult[] {
  const needle = normalize(query);
  if (!needle) return catalog.nodes.map((node) => ({ node, score: 0 }));
  return catalog.nodes
    .map((node) => {
      const id = normalize(node.id);
      const bareId = normalize(node.id.split(':').slice(1).join(':'));
      const label = normalize(node.label);
      const aliases = (node.aliases ?? []).map(normalize);
      let score = 0;
      if (bareId === needle || label === needle) score = 100;
      else if (id === needle) score = 95;
      else if (aliases.includes(needle)) score = 90;
      else if (bareId.includes(needle) || label.includes(needle)) score = 70;
      else if (aliases.some((alias) => alias.includes(needle))) score = 50;
      else if (normalize(node.description ?? '').includes(needle)) score = 30;
      return { node, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || (a.node.kind === 'data' ? -1 : b.node.kind === 'data' ? 1 : a.node.id.localeCompare(b.node.id)));
}

export function getCoverage(nodeId: string, category: KnowledgeCategory, catalog: KnowledgeCatalog = workflowKnowledgeCatalog): CoverageStatus | undefined {
  return catalog.nodes.find((node) => node.id === nodeId)?.coverage?.[category];
}

export function getKnowledgeNeighborhood(
  centerId: string,
  categories: readonly KnowledgeCategory[] = KNOWLEDGE_CATEGORIES,
  catalog: KnowledgeCatalog = workflowKnowledgeCatalog,
): KnowledgeNeighborhood {
  const center = catalog.nodes.find((node) => node.id === centerId);
  if (!center) throw new Error(`Unknown knowledge node: ${centerId}`);
  const allowed = new Set(categories);
  const relations = catalog.relations.filter((relation) => allowed.has(relation.category) && (relation.source === centerId || relation.target === centerId));
  const ids = new Set([centerId, ...relations.flatMap((relation) => [relation.source, relation.target])]);
  return { center, nodes: catalog.nodes.filter((node) => ids.has(node.id)), relations };
}

export function expandKnowledgeNeighborhood(
  nodeIds: readonly string[],
  categories: readonly KnowledgeCategory[] = KNOWLEDGE_CATEGORIES,
  catalog: KnowledgeCatalog = workflowKnowledgeCatalog,
): { nodes: KnowledgeNode[]; relations: KnowledgeCatalog['relations'] } {
  const relations = new Map<string, KnowledgeCatalog['relations'][number]>();
  const ids = new Set(nodeIds);
  for (const nodeId of nodeIds) {
    const neighborhood = getKnowledgeNeighborhood(nodeId, categories, catalog);
    for (const node of neighborhood.nodes) ids.add(node.id);
    for (const relation of neighborhood.relations) relations.set(relation.id, relation);
  }
  return { nodes: catalog.nodes.filter((node) => ids.has(node.id)), relations: [...relations.values()] };
}

export function validateKnowledgeCatalog(catalog: KnowledgeCatalog): string[] {
  const errors: string[] = [];
  const nodes = new Map<string, KnowledgeNode>();
  const expectedCoverageKeys = [...KNOWLEDGE_CATEGORIES].sort();
  for (const node of catalog.nodes) {
    if (nodes.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
    nodes.set(node.id, node);
    if (!(KNOWLEDGE_NODE_KINDS as readonly string[]).includes(node.kind)) errors.push(`invalid node kind: ${node.id}`);
    if (node.kind !== 'evidence' && !node.coverage) errors.push(`missing coverage: ${node.id}`);
    if (node.kind !== 'evidence' && node.coverage) {
      const actualKeys = Object.keys(node.coverage).sort();
      if (actualKeys.length !== expectedCoverageKeys.length || actualKeys.some((key, index) => key !== expectedCoverageKeys[index])) errors.push(`invalid coverage keys: ${node.id}`);
      for (const [category, status] of Object.entries(node.coverage)) {
        if (!(COVERAGE_STATUSES as readonly string[]).includes(status)) errors.push(`invalid coverage status: ${node.id}/${category}`);
      }
    }
    if (node.kind === 'screen' && (!node.path || !node.path.startsWith('/'))) errors.push(`invalid screen path: ${node.id}`);
    if (node.kind === 'evidence') {
      if (!node.source || !/^(docs|apps|packages)\/[A-Za-z0-9_./-]+(?:\.md|\.ts|\.tsx)(?:#[A-Za-z0-9_.:/-]+)?$/.test(node.source)) errors.push(`invalid evidence source: ${node.id}`);
      if (node.api && !/^(GET|POST|PUT|PATCH|DELETE) \/[A-Za-z0-9_{}?&=./:-]+$/.test(node.api)) errors.push(`invalid API identifier: ${node.id}`);
    }
  }

  for (const legacy of workflowNodes) {
    if (!catalog.nodes.some((node) => node.id === `activity:${legacy.id}` && node.kind === 'activity')) errors.push(`missing legacy activity: ${legacy.id}`);
  }

  const relationIds = new Set<string>();
  for (const relation of catalog.relations) {
    if (relationIds.has(relation.id)) errors.push(`duplicate relation id: ${relation.id}`);
    relationIds.add(relation.id);
    const validKind = (KNOWLEDGE_RELATION_KINDS as readonly string[]).includes(relation.kind);
    if (!validKind) errors.push(`invalid relation kind: ${relation.id}`);
    if (!(EVIDENCE_STATUSES as readonly string[]).includes(relation.evidenceStatus)) errors.push(`invalid evidence status: ${relation.id}`);
    if (!nodes.has(relation.source)) errors.push(`unknown source: ${relation.id} -> ${relation.source}`);
    if (!nodes.has(relation.target)) errors.push(`unknown target: ${relation.id} -> ${relation.target}`);
    if (!validKind || !RELATION_CATEGORY_BY_KIND[relation.kind]?.includes(relation.category)) errors.push(`invalid relation category: ${relation.id}`);
  }

  for (const node of catalog.nodes) {
    if (!node.coverage) continue;
    for (const category of KNOWLEDGE_CATEGORIES) {
      const related = catalog.relations.some((relation) => relation.category === category && (relation.source === node.id || relation.target === node.id));
      if (node.coverage[category] === 'present' && !related) errors.push(`present without relation: ${node.id}/${category}`);
      if (node.coverage[category] === 'none' && related) errors.push(`none with relation: ${node.id}/${category}`);
    }
  }

  if (catalog.nodes.length > 1) {
    for (const node of catalog.nodes) {
      if (!catalog.relations.some((relation) => relation.source === node.id || relation.target === node.id)) errors.push(`orphan node: ${node.id}`);
    }
  }

  const adjacency = new Map<string, { target: string; cycle?: 'recovery' | 'rework' }[]>();
  for (const relation of catalog.relations) {
    if (!nodes.has(relation.source) || !nodes.has(relation.target)) continue;
    if (!['precedes', 'follows', 'branchesTo', 'raises', 'recoversWith'].includes(relation.kind)) continue;
    const list = adjacency.get(relation.source) ?? [];
    list.push({ target: relation.target, cycle: relation.cycle });
    adjacency.set(relation.source, list);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const walk = (id: string, stackNodes: string[], stackCycles: (string | undefined)[]): void => {
    if (visited.has(id)) return;
    visiting.add(id);
    stackNodes.push(id);
    for (const edge of adjacency.get(id) ?? []) {
      if (visiting.has(edge.target)) {
        const cycleStart = stackNodes.lastIndexOf(edge.target);
        const cycleTags = [...stackCycles.slice(cycleStart), edge.cycle];
        if (cycleTags.some((tag) => !tag)) errors.push(`unallowed cycle: ${edge.target}`);
      } else {
        stackCycles.push(edge.cycle);
        walk(edge.target, stackNodes, stackCycles);
        stackCycles.pop();
      }
    }
    stackNodes.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of nodes.keys()) walk(id, [], []);
  return [...new Set(errors)];
}
