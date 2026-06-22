import { BadRequestException } from '@nestjs/common';
import { AiPageToolsService } from './ai-page-tools.service';
import { PageToolProvider } from './types';

describe('AiPageToolsService (dispatcher)', () => {
  const stubProvider = (): PageToolProvider => ({
    pageId: 'demo.page',
    manifest: {
      pageId: 'demo.page',
      route: '/demo',
      title: '데모',
      executionLevel: 'approval-required',
      tools: [
        { name: 'doWrite', label: '쓰기', description: '', riskLevel: 'write', source: 'backend' },
        { name: 'frontTool', label: '프론트', description: '', riskLevel: 'draft', source: 'frontend' },
      ],
    },
    execute: jest.fn().mockResolvedValue({ status: 'ok', toolName: 'doWrite', summary: '완료' }),
  });

  it('returns the registered provider manifest', () => {
    const service = new AiPageToolsService([stubProvider()]);
    expect(service.getManifest('demo.page').pageId).toBe('demo.page');
  });

  it('rejects unknown page IDs', () => {
    const service = new AiPageToolsService([stubProvider()]);
    expect(() => service.getManifest('unknown.page')).toThrow(BadRequestException);
    expect(() => service.getManifest('unknown.page')).toThrow('지원하지 않는 AI 페이지 도구입니다');
  });

  it('rejects unknown tool name', async () => {
    const service = new AiPageToolsService([stubProvider()]);
    await expect(service.executeBackendTool('demo.page', 'nope', {})).rejects.toThrow('사용할 수 없는 도구');
  });

  it('rejects frontend-only tools on the backend', async () => {
    const service = new AiPageToolsService([stubProvider()]);
    await expect(service.executeBackendTool('demo.page', 'frontTool', {})).rejects.toThrow('프론트엔드 전용');
  });

  it('rejects unknown page for execution', async () => {
    const service = new AiPageToolsService([stubProvider()]);
    await expect(service.executeBackendTool('x.y', 'doWrite', {})).rejects.toThrow('구현되지 않은 페이지');
  });

  it('delegates to the provider with tenant context', async () => {
    const provider = stubProvider();
    const service = new AiPageToolsService([provider]);
    const res = await service.executeBackendTool('demo.page', 'doWrite', { a: 1 }, '40', '1000');
    expect((res as { summary: string }).summary).toBe('완료');
    expect(provider.execute).toHaveBeenCalledWith('doWrite', { a: 1 }, { company: '40', plant: '1000' });
  });
});
