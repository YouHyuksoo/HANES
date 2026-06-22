import { BadRequestException } from '@nestjs/common';
import { AiPageToolsService } from './ai-page-tools.service';
import { AiPageToolCandidateResult } from './types';

describe('AiPageToolsService', () => {
  const createRepo = () => ({ find: jest.fn() });

  it('returns production.order manifest as draft-only', () => {
    const service = new AiPageToolsService();

    const manifest = service.getManifest('production.order');

    expect(manifest.pageId).toBe('production.order');
    expect(manifest.route).toBe('/production/order');
    expect(manifest.executionLevel).toBe('draft-only');
    expect(manifest.tools.map((tool) => tool.name)).toContain('resolveItemCandidates');
    expect(manifest.tools.map((tool) => tool.name)).toContain('applyJobOrderDraft');
    expect(manifest.tools.find((tool) => tool.name === 'applyJobOrderDraft')?.neverPersists).toBe(true);
  });

  it('rejects unknown page IDs', () => {
    const service = new AiPageToolsService();

    expect(() => service.getManifest('unknown.page')).toThrow(BadRequestException);
    expect(() => service.getManifest('unknown.page')).toThrow('지원하지 않는 AI 페이지 도구입니다');
  });

  it('marks exact itemCode single match as autoConfirmable', async () => {
    const partRepo = createRepo();
    partRepo.find.mockResolvedValue([
      { itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED', modelName: '차종A' },
    ]);
    const service = new AiPageToolsService(partRepo as never);

    const result = (await service.executeBackendTool(
      'production.order',
      'resolveItemCandidates',
      { query: 'HNS02' },
      '40',
      '1000',
    )) as AiPageToolCandidateResult;

    expect(result.status).toBe('ok');
    expect(result.candidates).toHaveLength(1);
    expect(result.confirmation.required).toBe(false);
    expect(result.confirmation.reason).toBe('none');
  });

  it('requires confirmation for name-based single match', async () => {
    const partRepo = createRepo();
    partRepo.find.mockResolvedValue([
      { itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED', modelName: '차종A' },
    ]);
    const service = new AiPageToolsService(partRepo as never);

    const result = (await service.executeBackendTool(
      'production.order',
      'resolveItemCandidates',
      { query: '메인 하네스' },
      '40',
      '1000',
    )) as AiPageToolCandidateResult;

    expect(result.status).toBe('ok');
    expect(result.candidates).toHaveLength(1);
    expect(result.confirmation.required).toBe(true);
    expect(result.confirmation.reason).toBe('single_name_match');
  });

  it('requires user selection for multiple item candidates', async () => {
    const partRepo = createRepo();
    partRepo.find.mockResolvedValue([
      { itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED', modelName: '차종A' },
      { itemCode: 'HNS02C1ABCD', itemName: '서브 하네스', itemType: 'SEMI_PRODUCT', modelName: '차종A' },
    ]);
    const service = new AiPageToolsService(partRepo as never);

    const result = (await service.executeBackendTool(
      'production.order',
      'resolveItemCandidates',
      { query: 'HNS' },
      '40',
      '1000',
    )) as AiPageToolCandidateResult;

    expect(result.status).toBe('ok');
    expect(result.candidates).toHaveLength(2);
    expect(result.confirmation.required).toBe(true);
    expect(result.confirmation.reason).toBe('multiple_candidates');
  });
});
