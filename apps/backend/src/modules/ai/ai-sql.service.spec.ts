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
    // 지식 풀 파이프라인은 실패시켜 기존 단일 검색(this.knowledge.search) 폴백 경로를 타게 한다.
    // (이 스펙의 테스트들은 knowledge.search/formatContext 목의 반환값으로 시나리오를 검증하므로 의도를 보존한다)
    const knowledgePipeline = {
      retrieve: jest.fn().mockRejectedValue(new Error('pipeline test stub')),
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
      knowledgePipeline as any,
      dataSource as any,
    );

    return { target, catalog, schemaInfo, validator, dataSource, knowledge, pageTools };
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

  it('/MES 명시 모드는 page tool context가 있어도 SQL 조회를 우선한다', async () => {
    const complete = jest
      .fn()
      .mockResolvedValueOnce('["ITEM_MASTERS"]')
      .mockResolvedValueOnce('SELECT COUNT(*) AS ITEM_MASTER_COUNT FROM ITEM_MASTERS')
      .mockResolvedValueOnce('품목마스터는 34건입니다.');
    const { target, catalog, schemaInfo, dataSource, pageTools } = createTarget(complete);
    catalog.getSelectionCatalog.mockResolvedValueOnce({
      catalog: 'ITEM_MASTERS: 품목 마스터 (동의어: 품목, 품목마스터, 품목 마스터)',
      tables: ['ITEM_MASTERS'],
    });
    schemaInfo.getSchemaText.mockResolvedValueOnce('ITEM_MASTERS(ITEM_CODE -- 품목코드)');
    dataSource.query.mockResolvedValueOnce([{ ITEM_MASTER_COUNT: 34 }]);

    const result = await target.process(
      [{ role: 'user', content: '/MES 품목 마스터 등록건수 알려줘' }],
      { pageId: 'MST_PART', executionLevel: 'assist', tools: [] } as any,
    );

    expect(pageTools.getManifest).not.toHaveBeenCalled();
    expect(result.executed).toBe(true);
    expect(result.sql).toContain('ITEM_MASTERS');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT COUNT(*) AS ITEM_MASTER_COUNT FROM ITEM_MASTERS'),
    );
  });

  it('등록건수 같은 조회 질문은 page tool context가 있어도 SQL 조회를 우선한다', async () => {
    const complete = jest
      .fn()
      .mockResolvedValueOnce('["ITEM_MASTERS"]')
      .mockResolvedValueOnce('SELECT COUNT(*) AS ITEM_MASTER_COUNT FROM ITEM_MASTERS')
      .mockResolvedValueOnce('품목마스터는 34건입니다.');
    const { target, catalog, schemaInfo, dataSource, pageTools } = createTarget(complete);
    catalog.getSelectionCatalog.mockResolvedValueOnce({
      catalog: 'ITEM_MASTERS: 품목 마스터 (동의어: 품목, 품목마스터, 품목 마스터)',
      tables: ['ITEM_MASTERS'],
    });
    schemaInfo.getSchemaText.mockResolvedValueOnce('ITEM_MASTERS(ITEM_CODE -- 품목코드)');
    dataSource.query.mockResolvedValueOnce([{ ITEM_MASTER_COUNT: 34 }]);

    const result = await target.process(
      [{ role: 'user', content: '품목 마스터 등록건수 알려줘' }],
      { pageId: 'MST_PART', executionLevel: 'assist', tools: [] } as any,
    );

    expect(pageTools.getManifest).not.toHaveBeenCalled();
    expect(result.executed).toBe(true);
    expect(result.sql).toContain('ITEM_MASTERS');
  });

  it('/HELP 명시 모드는 SQL 테이블 선택 없이 도움말 답변으로 보낸다', async () => {
    const complete = jest.fn().mockResolvedValueOnce('도움말 답변');
    const { target, catalog, knowledge } = createTarget(complete);
    knowledge.search.mockResolvedValueOnce([
      {
        chunkId: 'help:user:mst-part',
        score: 0.9,
        sourcePath: 'apps/frontend/public/help/user/ko/MST_PART.md',
        docType: 'help',
        menuCode: 'MST_PART',
        audience: 'user',
        title: '품목마스터',
        heading: '사용 순서',
        content: '품목마스터 사용 순서',
      },
    ]);
    knowledge.formatContext.mockReturnValueOnce('[1] 품목마스터 > 사용 순서\n품목마스터 사용 순서');

    const result = await target.process([{ role: 'user', content: '/HELP 품목 마스터 등록 방법 알려줘' }]);

    expect(catalog.getSelectionCatalog).not.toHaveBeenCalled();
    expect(result.content).toBe('도움말 답변');
  });

  it('/DO 명시 모드는 작업 동사가 없어도 page tool 후보를 선택한다', async () => {
    const complete = jest.fn().mockResolvedValueOnce('{"toolName":"createPart","input":{"itemCode":"A001"}}');
    const { target, pageTools } = createTarget(complete);
    pageTools.getManifest.mockReturnValueOnce({
      tools: [
        {
          name: 'createPart',
          label: '품목 등록',
          description: '품목을 등록한다.',
          source: 'backend',
          riskLevel: 'write',
          inputSchema: {},
        },
      ],
    });

    const result = await target.process(
      [{ role: 'user', content: '/DO 품목 A001' }],
      { pageId: 'MST_PART', executionLevel: 'assist', tools: [] } as any,
    );

    expect(result.requiresApproval).toBe(true);
    expect(result.pageToolCall?.toolName).toBe('createPart');
    expect(result.pageToolCall?.input).toEqual({ itemCode: 'A001' });
  });

  it('/WEB 명시 모드는 현재 미연결 상태를 안내하고 LLM이나 SQL을 호출하지 않는다', async () => {
    const complete = jest.fn();
    const { target, catalog, dataSource } = createTarget(complete);

    const result = await target.process([{ role: 'user', content: '/WEB Oracle 23ai JSON duality view 찾아줘' }]);

    expect(result.content).toContain('/WEB 외부 웹 검색은 현재 HANES 백엔드 AI 채팅 파이프라인에 연결되어 있지 않습니다');
    expect(complete).not.toHaveBeenCalled();
    expect(catalog.getSelectionCatalog).not.toHaveBeenCalled();
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});

describe('AiSqlService knowledge pipeline 연동', () => {
  it('process가 KnowledgePipelineService.retrieve 결과를 knowledgePrompt와 sources로 사용한다', async () => {
    const pipeline = {
      retrieve: jest.fn().mockResolvedValue({
        intent: 'workflow',
        prompt: '## 워크플로우 전후 단계\n내용',
        chunks: [
          {
            chunkId: 'c1', score: 0.5, sourcePath: 'docs/workflows/prod.md', docType: 'workflow',
            menuCode: 'JOB_ORDER', audience: undefined, title: '생산 흐름', heading: '개요', content: '...',
          },
        ],
      }),
    };
    const aiService = { complete: jest.fn().mockResolvedValue('답변') };
    const service = new AiSqlService(
      aiService as any,
      { getSelectionCatalog: jest.fn().mockResolvedValue({ catalog: '', tables: [] }), getRelationsText: jest.fn() } as any,
      { getSelectionCatalog: jest.fn().mockResolvedValue({ catalog: '', tables: [] }), getSchemaText: jest.fn() } as any,
      { validate: jest.fn(), stripFences: jest.fn((s: string) => s) } as any,
      { getManifest: jest.fn() } as any,
      { formatContext: jest.fn() } as any,
      pipeline as any,
      {} as any,
    );
    // selectTables가 빈 배열 → generalChat 경로
    jest.spyOn(service as any, 'selectTables').mockResolvedValue([]);

    const result = await service.process([{ role: 'user', content: '작업지시 다음엔 뭐 해?' }], undefined, { persona: 'user' } as any);

    expect(pipeline.retrieve).toHaveBeenCalledWith('작업지시 다음엔 뭐 해?', { persona: 'user' });
    expect(result.sources?.[0].chunkId).toBe('c1');
    // generalChat system 프롬프트에 파이프라인 prompt가 포함되어야 한다
    const systemContent = aiService.complete.mock.calls[0][0][0].content as string;
    expect(systemContent).toContain('워크플로우 전후 단계');
  });

  it('파이프라인 실패 시 기존 단일 검색으로 폴백한다', async () => {
    const pipeline = { retrieve: jest.fn().mockRejectedValue(new Error('LLM down')) };
    const knowledge = {
      search: jest.fn().mockResolvedValue([]),
      formatContext: jest.fn().mockReturnValue(''),
    };
    const aiService = { complete: jest.fn().mockResolvedValue('답변') };
    const service = new AiSqlService(
      aiService as any,
      { getSelectionCatalog: jest.fn().mockResolvedValue({ catalog: '', tables: [] }), getRelationsText: jest.fn() } as any,
      { getSelectionCatalog: jest.fn().mockResolvedValue({ catalog: '', tables: [] }), getSchemaText: jest.fn() } as any,
      { validate: jest.fn(), stripFences: jest.fn((s: string) => s) } as any,
      { getManifest: jest.fn() } as any,
      knowledge as any,
      pipeline as any,
      {} as any,
    );
    jest.spyOn(service as any, 'selectTables').mockResolvedValue([]);

    const result = await service.process([{ role: 'user', content: '질문' }], undefined, {} as any);

    expect(knowledge.search).toHaveBeenCalled();
    expect(result.content).toBeTruthy();
  });
});
