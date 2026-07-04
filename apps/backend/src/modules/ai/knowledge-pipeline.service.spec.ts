/**
 * @file src/modules/ai/knowledge-pipeline.service.spec.ts
 * @description 질의이해→RRF→그래프확장→리랭크 파이프라인 단위 테스트 (LLM/검색 mock)
 */
jest.mock('@mistralai/mistralai', () => ({ Mistral: jest.fn() }));
// appendTrace가 테스트 실행 중 실제 트레이스 파일을 쓰지 않도록 차단한다.
jest.mock('fs/promises', () => ({ appendFile: jest.fn().mockResolvedValue(undefined) }));

import { KnowledgePipelineService } from './knowledge-pipeline.service';

function chunk(id: string, over: Record<string, unknown> = {}) {
  return {
    chunkId: id,
    score: 0,
    sourcePath: `help/user/ko/${id}.md`,
    docType: 'help',
    menuCode: id.toUpperCase(),
    audience: 'user',
    title: id,
    heading: '사용 순서',
    summary: undefined,
    content: `${id} 내용`,
    ...over,
  };
}

function makeService(overrides: { complete?: jest.Mock; knowledge?: Record<string, jest.Mock> } = {}) {
  const complete = overrides.complete ?? jest.fn();
  const knowledge = {
    search: jest.fn().mockResolvedValue([]),
    getWorkflowContext: jest.fn().mockReturnValue({ workflows: [], prevMenus: [], nextMenus: [], requires: [] }),
    getMenuOverviewChunks: jest.fn().mockReturnValue([]),
    getWorkflowDocChunks: jest.fn().mockReturnValue([]),
    getBusinessLogicChunks: jest.fn().mockReturnValue([]),
    getMenuCatalog: jest.fn().mockReturnValue([]),
    searchTroubleshooting: jest.fn().mockReturnValue([]),
    formatContext: jest.fn((chunks: unknown[]) => (chunks as Array<{ chunkId: string }>).map((c, i) => `[${i + 1}] ${c.chunkId}`).join('\n')),
    ...overrides.knowledge,
  };
  const service = new KnowledgePipelineService({ complete } as any, knowledge as any);
  return { service, complete, knowledge };
}

describe('KnowledgePipelineService', () => {
  it('질의이해 JSON 실패 시 원문 단일 질의로 폴백한다', async () => {
    const { service, knowledge } = makeService({
      complete: jest.fn().mockResolvedValueOnce('말도 안 되는 답').mockResolvedValue('[]'),
      knowledge: { search: jest.fn().mockResolvedValue([chunk('a')]) },
    });
    const result = await service.retrieve('박스입고 어떻게 해?', { menuCode: 'FG_RECEIVE' } as any);
    expect(knowledge.search).toHaveBeenCalledTimes(1);
    expect(knowledge.search.mock.calls[0][0]).toBe('박스입고 어떻게 해?');
    expect(result.intent).toBe('usage');
    expect(result.chunks.map((c) => c.chunkId)).toEqual(['a']);
  });

  it('멀티 질의 결과를 RRF로 융합한다 — 두 질의 모두 상위인 청크가 1위', async () => {
    const understanding = JSON.stringify({ intent: 'usage', queries: ['질의1', '질의2'], menus: [] });
    const search = jest
      .fn()
      .mockResolvedValueOnce([chunk('both'), chunk('only1')])
      .mockResolvedValueOnce([chunk('only2'), chunk('both')]);
    const { service } = makeService({
      complete: jest.fn().mockResolvedValueOnce(understanding).mockResolvedValue('invalid-json-rerank-fallback'),
      knowledge: { search },
    });
    const result = await service.retrieve('아무 질문', {} as any);
    expect(result.chunks[0].chunkId).toBe('both');
  });

  it('workflow 의도면 그래프 이웃/워크플로우 문서 청크를 강제 포함하고 프롬프트에 전후 단계 섹션을 만든다', async () => {
    const understanding = JSON.stringify({ intent: 'workflow', queries: ['다음 단계'], menus: ['JOB_ORDER'] });
    const { service, knowledge } = makeService({
      complete: jest.fn().mockResolvedValueOnce(understanding).mockResolvedValue('[]'),
      knowledge: {
        search: jest.fn().mockResolvedValue([chunk('job_order')]),
        getWorkflowContext: jest.fn().mockReturnValue({
          workflows: [{ workflowId: 'PROD_FLOW', title: '생산 흐름', stepIndex: 2, totalSteps: 4 }],
          prevMenus: ['PROD_PLAN'],
          nextMenus: ['PROD_INPUT_KIOSK'],
          requires: [],
        }),
        getMenuOverviewChunks: jest.fn().mockReturnValue([chunk('prod_plan'), chunk('prod_input_kiosk')]),
        getWorkflowDocChunks: jest.fn().mockReturnValue([chunk('wf', { docType: 'workflow', menuCode: undefined })]),
      },
    });
    const result = await service.retrieve('작업지시 다음엔 뭐 해?', { menuCode: 'JOB_ORDER' } as any);
    expect(knowledge.getMenuOverviewChunks).toHaveBeenCalled();
    const ids = result.chunks.map((c) => c.chunkId);
    expect(ids).toEqual(expect.arrayContaining(['prod_plan', 'prod_input_kiosk', 'wf']));
    expect(result.prompt).toContain('워크플로우 전후 단계');
  });

  it('troubleshoot 의도면 troubleshooting 매칭을 프롬프트에 포함한다', async () => {
    const understanding = JSON.stringify({ intent: 'troubleshoot', queries: ['라벨 발행 안 됨'], menus: [] });
    const { service } = makeService({
      complete: jest.fn().mockResolvedValueOnce(understanding).mockResolvedValue('[]'),
      knowledge: {
        search: jest.fn().mockResolvedValue([chunk('a')]),
        searchTroubleshooting: jest.fn().mockReturnValue([
          { workflowId: 'PROD_FLOW', symptom: '라벨 발행이 안 됨', causes: ['상태 오류'], resolutions: ['상태 확인'] },
        ]),
      },
    });
    const result = await service.retrieve('라벨 발행이 안 되는데 왜?', {} as any);
    expect(result.prompt).toContain('문제 해결');
    expect(result.prompt).toContain('라벨 발행이 안 됨');
  });

  it('리랭크가 유효한 JSON을 주면 그 순서를 따른다 (강제 포함 청크는 유지)', async () => {
    const understanding = JSON.stringify({ intent: 'usage', queries: ['질의'], menus: [] });
    const { service } = makeService({
      complete: jest
        .fn()
        .mockResolvedValueOnce(understanding)
        .mockResolvedValueOnce('[2, 1]'),
      knowledge: { search: jest.fn().mockResolvedValue([chunk('first'), chunk('second')]) },
    });
    const result = await service.retrieve('질문', {} as any);
    expect(result.chunks.map((c) => c.chunkId)).toEqual(['second', 'first']);
  });

  it('engineer 의도면 매칭 메뉴의 business-logics 청크를 강제 포함하고 비즈니스 로직 섹션을 만든다', async () => {
    const understanding = JSON.stringify({ intent: 'engineer', queries: ['박스입고 테이블 변경'], menus: [] });
    const { service, knowledge } = makeService({
      complete: jest.fn().mockResolvedValueOnce(understanding).mockResolvedValue('[]'),
      knowledge: {
        search: jest.fn().mockResolvedValue([chunk('prod_receive')]),
        getBusinessLogicChunks: jest.fn().mockReturnValue([
          chunk('bl', { sourcePath: 'docs/business-logics/PROD_RECEIVE.md', docType: 'document', audience: undefined }),
        ]),
      },
    });
    const result = await service.retrieve('박스입고 저장하면 어떤 테이블이 바뀌어?', {} as any);
    expect(knowledge.getBusinessLogicChunks).toHaveBeenCalledWith(['PROD_RECEIVE'], 8);
    expect(result.chunks.map((c) => c.chunkId)).toContain('bl');
    expect(result.prompt).toContain('비즈니스 로직');
  });
});
