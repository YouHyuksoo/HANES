import {
  KNOWLEDGE_CATEGORIES,
  getCoverage,
  getKnowledgeNeighborhood,
  searchKnowledge,
  validateKnowledgeCatalog,
  workflowKnowledgeCatalog,
  workflowNodes,
  type KnowledgeCatalog,
  type KnowledgeCategory,
  type KnowledgeRelationKind,
} from '@harness/shared';

describe('workflow knowledge graph', () => {
  it('validates the curated catalog', () => {
    expect(validateKnowledgeCatalog(workflowKnowledgeCatalog)).toEqual([]);
  });

  it('ranks an exact data object match first', () => {
    expect(searchKnowledge('MAT_LOTS')[0]?.node.id).toBe('data:MAT_LOTS');
  });

  it('returns table references in the arrival neighborhood', () => {
    const result = getKnowledgeNeighborhood('activity:arrival-register', ['tables']);
    expect(result.nodes.map((node) => node.id)).toContain('data:MAT_LOTS');
  });

  it('does not present an inferred arrival constraint as known', () => {
    expect(getCoverage('activity:arrival-register', 'constraints')).toBe('undocumented');
  });

  it('reports unknown targets and duplicate relation ids', () => {
    const invalid: KnowledgeCatalog = {
      nodes: [node('activity:a'), node('activity:b')],
      relations: [
        relation('duplicate', 'activity:a', 'activity:b'),
        relation('duplicate', 'activity:a', 'activity:missing'),
      ],
    };
    const errors = validateKnowledgeCatalog(invalid).join('\n');
    expect(errors).toContain('duplicate relation id');
    expect(errors).toContain('unknown target');
  });

  it('enforces present and none coverage invariants', () => {
    const presentWithoutRelation = node('activity:a');
    presentWithoutRelation.coverage!.tables = 'present';
    const noneWithRelation = node('activity:b');
    noneWithRelation.coverage!.tables = 'none';
    const catalog: KnowledgeCatalog = {
      nodes: [presentWithoutRelation, noneWithRelation, dataNode('data:T')],
      relations: [relation('b-table', 'activity:b', 'data:T', 'references', 'tables')],
    };
    const errors = validateKnowledgeCatalog(catalog).join('\n');
    expect(errors).toContain('present without relation');
    expect(errors).toContain('none with relation');
  });

  it('indexes every legacy activity id', () => {
    for (const legacyNode of workflowNodes) {
      expect(searchKnowledge(legacyNode.id).some(({ node }) => node.id === `activity:${legacyNode.id}`)).toBe(true);
    }
  });

  it('preserves absolute legacy route paths on screen nodes', () => {
    const screenNodes = workflowKnowledgeCatalog.nodes.filter((node) => node.kind === 'screen');
    expect(screenNodes.length).toBeGreaterThan(0);
    for (const screen of screenNodes) {
      expect(screen.path).toMatch(/^\//);
      expect(workflowNodes.some((legacy) => legacy.routes.some((route) => route.path === screen.path))).toBe(true);
    }
  });

  it('validates evidence source and API identifiers', () => {
    const catalog: KnowledgeCatalog = {
      nodes: [
        node('activity:a'),
        { id: 'evidence:bad', kind: 'evidence', label: 'bad', source: 'guess', api: 'arrival' },
      ],
      relations: [relation('evidence', 'activity:a', 'evidence:bad', 'evidencedBy', 'logic')],
    };
    const errors = validateKnowledgeCatalog(catalog).join('\n');
    expect(errors).toContain('invalid evidence source');
    expect(errors).toContain('invalid API identifier');
  });

  it('rejects unallowed cycles and orphan nodes', () => {
    const catalog: KnowledgeCatalog = {
      nodes: [node('activity:a'), node('activity:b'), node('activity:orphan')],
      relations: [
        relation('a-b', 'activity:a', 'activity:b', 'precedes', 'flow'),
        relation('b-a', 'activity:b', 'activity:a', 'precedes', 'flow'),
      ],
    };
    const errors = validateKnowledgeCatalog(catalog).join('\n');
    expect(errors).toContain('unallowed cycle');
    expect(errors).toContain('orphan node');
  });

  it('allows explicitly tagged recovery cycles', () => {
    const a = node('activity:a');
    const b = node('activity:b');
    a.coverage!.exceptions = 'present';
    b.coverage!.exceptions = 'present';
    const catalog: KnowledgeCatalog = {
      nodes: [a, b],
      relations: [
        { ...relation('a-b', 'activity:a', 'activity:b', 'raises', 'exceptions'), cycle: 'recovery' },
        { ...relation('b-a', 'activity:b', 'activity:a', 'recoversWith', 'exceptions'), cycle: 'recovery' },
      ],
    };
    expect(validateKnowledgeCatalog(catalog)).toEqual([]);
  });

  it.each(KNOWLEDGE_CATEGORIES)('filters neighborhood relations for %s', (category) => {
    const result = getKnowledgeNeighborhood('activity:arrival-register', [category]);
    expect(result.relations.every((relation) => relation.category === category)).toBe(true);
    const other = KNOWLEDGE_CATEGORIES.find((candidate) => candidate !== category)!;
    expect(result.relations.some((relation) => relation.category === other)).toBe(false);
  });
});

function coverage() {
  return Object.fromEntries(KNOWLEDGE_CATEGORIES.map((category) => [category, 'undocumented'])) as Record<(typeof KNOWLEDGE_CATEGORIES)[number], 'undocumented' | 'present' | 'none'>;
}

function node(id: string) {
  return { id, kind: 'activity' as const, label: id, coverage: coverage() };
}

function dataNode(id: string) {
  return { id, kind: 'data' as const, label: id };
}

function relation(id: string, source: string, target: string, kind: KnowledgeRelationKind = 'references', category: KnowledgeCategory = 'tables') {
  return { id, source, target, kind, category, evidenceStatus: 'verified' as const };
}
