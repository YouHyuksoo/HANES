import { ProductionOrderToolsProvider } from './production-order-tools.provider';
import { AiPageToolCandidateResult } from '../types';

describe('ProductionOrderToolsProvider', () => {
  const createRepo = () => ({ find: jest.fn() });

  it('exposes the production.order draft-only manifest', () => {
    const provider = new ProductionOrderToolsProvider();
    expect(provider.pageId).toBe('production.order');
    expect(provider.manifest.executionLevel).toBe('draft-only');
    expect(provider.manifest.tools.map((tool) => tool.name)).toContain('resolveItemCandidates');
    expect(provider.manifest.tools.find((tool) => tool.name === 'applyJobOrderDraft')?.neverPersists).toBe(true);
  });

  it('marks exact itemCode single match as autoConfirmable', async () => {
    const partRepo = createRepo();
    partRepo.find.mockResolvedValue([{ itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED', modelName: '차종A' }]);
    const provider = new ProductionOrderToolsProvider(partRepo as never);

    const result = (await provider.execute('resolveItemCandidates', { query: 'HNS02' }, { company: '40', plant: '1000' })) as AiPageToolCandidateResult;

    expect(result.candidates).toHaveLength(1);
    expect(result.confirmation.required).toBe(false);
    expect(result.confirmation.reason).toBe('none');
  });

  it('requires confirmation for name-based single match', async () => {
    const partRepo = createRepo();
    partRepo.find.mockResolvedValue([{ itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED', modelName: '차종A' }]);
    const provider = new ProductionOrderToolsProvider(partRepo as never);

    const result = (await provider.execute('resolveItemCandidates', { query: '메인 하네스' }, {})) as AiPageToolCandidateResult;

    expect(result.candidates).toHaveLength(1);
    expect(result.confirmation.reason).toBe('single_name_match');
  });

  it('requires user selection for multiple item candidates', async () => {
    const partRepo = createRepo();
    partRepo.find.mockResolvedValue([
      { itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED', modelName: '차종A' },
      { itemCode: 'HNS02C1ABCD', itemName: '서브 하네스', itemType: 'SEMI_PRODUCT', modelName: '차종A' },
    ]);
    const provider = new ProductionOrderToolsProvider(partRepo as never);

    const result = (await provider.execute('resolveItemCandidates', { query: 'HNS' }, {})) as AiPageToolCandidateResult;

    expect(result.candidates).toHaveLength(2);
    expect(result.confirmation.reason).toBe('multiple_candidates');
  });

  it('blocks non-read tools on the server', async () => {
    const provider = new ProductionOrderToolsProvider();
    await expect(provider.execute('applyJobOrderDraft', {}, {})).rejects.toThrow('후보조회(read) 도구만');
  });
});
