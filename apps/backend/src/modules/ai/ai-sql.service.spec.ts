/**
 * @file src/modules/ai/ai-sql.service.spec.ts
 * @description AiSqlService 응답 품질 프롬프트 단위 테스트
 */
jest.mock('@mistralai/mistralai', () => ({ Mistral: jest.fn() }));

import { AiSqlService } from './ai-sql.service';

describe('AiSqlService response quality prompts', () => {
  const createTarget = (complete: jest.Mock) => {
    const aiService = { complete };
    const catalog = {
      getSelectionCatalog: jest.fn().mockResolvedValue({
        catalog: 'PARTNER_MASTERS: 거래처 마스터',
        tables: ['PARTNER_MASTERS'],
      }),
      getRelationsText: jest.fn().mockResolvedValue(''),
    };
    const schemaInfo = {
      getSelectionCatalog: jest.fn(),
      getSchemaText: jest.fn().mockResolvedValue('PARTNER_MASTERS(PARTNER_NAME -- 거래처명)'),
    };
    const validator = {
      validate: jest.fn().mockReturnValue({ valid: true, kind: 'select' }),
      stripFences: jest.fn((sql: string) => sql.trim()),
    };
    const pageTools = { getManifest: jest.fn() };
    const knowledge = {
      search: jest.fn().mockResolvedValue([]),
      formatContext: jest.fn().mockReturnValue(''),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([{ PARTNER_NAME: '테스트 거래처' }]),
    };

    const target = new AiSqlService(
      aiService as any,
      catalog as any,
      schemaInfo as any,
      validator as any,
      pageTools as any,
      knowledge as any,
      dataSource as any,
    );

    return { target, catalog, schemaInfo, validator, dataSource, knowledge };
  };

  it('일반 대화 system prompt는 단순 답변 대신 근거와 후속 확인을 요구한다', async () => {
    const complete = jest.fn().mockResolvedValueOnce('[]').mockResolvedValueOnce('답변');
    const { target, knowledge } = createTarget(complete);
    knowledge.search.mockResolvedValueOnce([
      {
        chunkId: 'help:user:sys-config',
        score: 0.9,
        sourcePath: 'apps/frontend/public/help/user/ko/SYS_CONFIG.md',
        docType: 'help',
        menuCode: 'SYS_CONFIG',
        audience: 'user',
        title: '환경설정',
        heading: '사용 순서',
        content: '환경설정은 저장 전 변경 항목을 확인합니다.',
      },
    ]);
    knowledge.formatContext.mockReturnValueOnce('[1] 환경설정 (사용자 도움말) > 사용 순서\nsource=apps/frontend/public/help/user/ko/SYS_CONFIG.md\n환경설정은 저장 전 변경 항목을 확인합니다.');

    await target.process([{ role: 'user', content: '시스템 환경설정은 어떻게 관리해?' }]);

    const systemPrompt = complete.mock.calls.at(-1)[0][0].content as string;
    expect(systemPrompt).toContain('질문에 바로 답한 뒤');
    expect(systemPrompt).toContain('확인한 근거');
    expect(systemPrompt).toContain('업무 영향');
    expect(systemPrompt).toContain('다음 확인');
  });

  it('도움말 문서나 SQL 결과가 없으면 LLM 일반지식 답변을 생성하지 않는다', async () => {
    const complete = jest.fn().mockResolvedValueOnce('[]').mockResolvedValueOnce('모델 일반지식 답변');
    const { target } = createTarget(complete);

    const result = await target.process([{ role: 'user', content: '생산실적 처리를 어떻게 하나?' }]);

    expect(result.content).toContain('도움말/문서 출처를 찾지 못했습니다');
    expect(result.sources).toBeUndefined();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('데이터 분석 prompt는 조회 결과의 조건, 근거, 한계를 설명하도록 요구한다', async () => {
    const complete = jest
      .fn()
      .mockResolvedValueOnce('["PARTNER_MASTERS"]')
      .mockResolvedValueOnce('SELECT PARTNER_NAME FROM PARTNER_MASTERS')
      .mockResolvedValueOnce('분석');
    const { target } = createTarget(complete);

    await target.process([{ role: 'user', content: '테스트 거래처 알려줘' }]);

    const analysisSystemPrompt = complete.mock.calls.at(-1)[0][0].content as string;
    const analysisUserPrompt = complete.mock.calls.at(-1)[0][1].content as string;
    expect(analysisSystemPrompt).toContain('조회 조건');
    expect(analysisSystemPrompt).toContain('확인한 데이터');
    expect(analysisSystemPrompt).toContain('판단 근거');
    expect(analysisSystemPrompt).toContain('추가 확인');
    expect(analysisUserPrompt).toContain('결과 행 수: 1');
  });
});
