/**
 * @file src/modules/ai-knowledge/ai-knowledge.service.spec.ts
 * @description AiKnowledgeService 검색 랭킹 단위 테스트
 */
import { AiKnowledgeService } from './ai-knowledge.service';

describe('AiKnowledgeService search ranking', () => {
  it('일반사용자 페르소나는 같은 메뉴의 사용자 도움말을 운영자/비즈니스 문서보다 우선 포함한다', async () => {
    const rowsById = new Map([
      [
      'business',
        {
          chunkId: 'business',
          docType: 'document',
          sourcePath: 'docs/business-logics/PROD_RESULT.md',
          menuCode: 'PROD_RESULT',
          audience: null,
          title: '생산실적 조회 — 비즈니스 로직 & 데이터 흐름 분석',
          heading: '6. 처리 규칙',
          summary: null,
          content: '삭제 시 역분개, 수정 시 재동기화',
        },
      ],
      [
      'operator',
        {
          chunkId: 'operator',
          docType: 'help',
          sourcePath: 'apps/frontend/public/help/operator/ko/PROD_RESULT.md',
          menuCode: 'PROD_RESULT',
          audience: 'operator',
          title: '생산실적 — 운영 가이드',
          heading: '③ 실적 취소',
          summary: null,
          content: '취소 시 재고 복원',
        },
      ],
      [
      'user',
        {
          chunkId: 'user',
          docType: 'help',
          sourcePath: 'apps/frontend/public/help/user/ko/PROD_RESULT.md',
          menuCode: 'PROD_RESULT',
          audience: 'user',
          title: '생산실적',
          heading: '사용 순서',
          summary: null,
          content: '조회 조건을 설정하고 목록에서 상태와 수량을 확인합니다.',
        },
      ],
    ]);
    const db = {
      prepare: jest.fn((sql: string) => {
        if (sql.includes('FROM ai_knowledge_fts')) {
          return {
            all: jest.fn().mockReturnValue([
              { chunkId: 'business', rank: -10 },
              { chunkId: 'operator', rank: -9 },
              { chunkId: 'user', rank: -1 },
            ]),
          };
        }
        if (/FROM\s+ai_knowledge_chunks[\s\S]*WHERE\s+menu_code\s*=\s*\?/m.test(sql)) {
          return {
            all: jest.fn().mockReturnValue([
              { chunkId: 'business', docType: 'document', audience: null, sourcePath: 'docs/business-logics/PROD_RESULT.md' },
              { chunkId: 'operator', docType: 'help', audience: 'operator', sourcePath: 'apps/frontend/public/help/operator/ko/PROD_RESULT.md' },
              { chunkId: 'user', docType: 'help', audience: 'user', sourcePath: 'apps/frontend/public/help/user/ko/PROD_RESULT.md' },
            ]),
          };
        }
        if (sql.includes('keywords_json') && sql.includes('LIKE')) {
          return {
            all: jest.fn().mockReturnValue([]),
          };
        }
        if (sql.includes('WHERE chunk_id IN')) {
          return {
            all: jest.fn((...ids: string[]) => ids.map((id) => rowsById.get(id))),
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    const service = new AiKnowledgeService({ embed: jest.fn() } as any);
    (service as any).db = db;
    (service as any).vectorEnabled = false;

    const result = await service.search(
      '생산실적 처리를 어떻게 하나?',
      { menuCode: 'PROD_RESULT', audience: 'user', language: 'ko' },
      2,
    );

    expect(result.map((row) => row.audience)).toContain('user');
    expect(result[0].audience).toBe('user');
  });

  it('시스템엔지니어 페르소나는 비즈니스 로직 문서를 우선 포함한다', async () => {
    const rowsById = new Map([
      [
        'business',
        {
          chunkId: 'business',
          docType: 'document',
          sourcePath: 'docs/business-logics/PROD_RESULT.md',
          menuCode: 'PROD_RESULT',
          audience: null,
          title: '생산실적 조회 — 비즈니스 로직 & 데이터 흐름 분석',
          heading: '6. 처리 규칙',
          summary: null,
          content: '삭제 시 역분개, 수정 시 재동기화',
        },
      ],
      [
        'user',
        {
          chunkId: 'user',
          docType: 'help',
          sourcePath: 'apps/frontend/public/help/user/ko/PROD_RESULT.md',
          menuCode: 'PROD_RESULT',
          audience: 'user',
          title: '생산실적',
          heading: '사용 순서',
          summary: null,
          content: '조회 조건을 설정하고 목록에서 상태와 수량을 확인합니다.',
        },
      ],
    ]);
    const db = {
      prepare: jest.fn((sql: string) => {
        if (sql.includes('FROM ai_knowledge_fts')) {
          return {
            all: jest.fn().mockReturnValue([
              { chunkId: 'user', rank: -9 },
              { chunkId: 'business', rank: -1 },
            ]),
          };
        }
        if (/FROM\s+ai_knowledge_chunks[\s\S]*WHERE\s+menu_code\s*=\s*\?/m.test(sql)) {
          return {
            all: jest.fn().mockReturnValue([
              { chunkId: 'user', docType: 'help', audience: 'user', sourcePath: 'apps/frontend/public/help/user/ko/PROD_RESULT.md' },
              { chunkId: 'business', docType: 'document', audience: null, sourcePath: 'docs/business-logics/PROD_RESULT.md' },
            ]),
          };
        }
        if (sql.includes('keywords_json') && sql.includes('LIKE')) {
          return {
            all: jest.fn().mockReturnValue([]),
          };
        }
        if (sql.includes('WHERE chunk_id IN')) {
          return {
            all: jest.fn((...ids: string[]) => ids.map((id) => rowsById.get(id))),
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    const service = new AiKnowledgeService({ embed: jest.fn() } as any);
    (service as any).db = db;
    (service as any).vectorEnabled = false;

    const result = await service.search(
      '생산실적 처리를 어떻게 하나?',
      { menuCode: 'PROD_RESULT', persona: 'engineer', language: 'ko' },
      1,
    );

    expect(result[0].sourcePath).toBe('docs/business-logics/PROD_RESULT.md');
  });

  it('현재 메뉴의 related 메타데이터가 가리키는 사용자 도움말을 관련 후보로 확장한다', async () => {
    const rowsById = new Map([
      [
        'result',
        {
          chunkId: 'result',
          docType: 'help',
          sourcePath: 'apps/frontend/public/help/user/ko/MENU_RESULT.md',
          menuCode: 'MENU_RESULT',
          audience: 'user',
          title: '업무 조회',
          heading: '사용 순서',
          summary: null,
          content: '업무 데이터를 조회하고 상태와 수량을 확인합니다.',
        },
      ],
      [
        'input',
        {
          chunkId: 'input',
          docType: 'help',
          sourcePath: 'apps/frontend/public/help/user/ko/MENU_INPUT.md',
          menuCode: 'MENU_INPUT',
          audience: 'user',
          title: '업무 입력',
          heading: '사용 순서',
          summary: null,
          content: '대상 선택, 수량 입력 후 저장합니다.',
        },
      ],
    ]);
    const db = {
      prepare: jest.fn((sql: string) => {
        if (sql.includes('FROM ai_knowledge_fts')) {
          return {
            all: jest.fn().mockReturnValue([{ chunkId: 'result', rank: -6 }]),
          };
        }
        if (/WHERE\s+menu_code\s*=\s*\?/m.test(sql)) {
          return {
            all: jest.fn().mockReturnValue([
              {
                chunkId: 'result',
                docType: 'help',
                audience: 'user',
                sourcePath: 'apps/frontend/public/help/user/ko/MENU_RESULT.md',
                relatedJson: '["MENU_INPUT"]',
              },
            ]),
          };
        }
        if (sql.includes('keywords_json') && sql.includes('LIKE')) {
          return {
            all: jest.fn().mockReturnValue([]),
          };
        }
        if (/WHERE\s+menu_code\s+IN\s+\(\?\)/m.test(sql)) {
          return {
            all: jest.fn().mockReturnValue([
              { chunkId: 'input', docType: 'help', audience: 'user', sourcePath: 'apps/frontend/public/help/user/ko/MENU_INPUT.md' },
            ]),
          };
        }
        if (sql.includes('WHERE chunk_id IN')) {
          return {
            all: jest.fn((...ids: string[]) => ids.map((id) => rowsById.get(id))),
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    const service = new AiKnowledgeService({ embed: jest.fn() } as any);
    (service as any).db = db;
    (service as any).vectorEnabled = false;

    const result = await service.search(
      '등록 방법을 알려줘',
      { menuCode: 'MENU_RESULT', persona: 'user', language: 'ko' },
      1,
    );

    expect(result[0].menuCode).toBe('MENU_INPUT');
    expect(result[0].sourcePath).toBe('apps/frontend/public/help/user/ko/MENU_INPUT.md');
  });

  it('붙여쓴 한글 질문에서 FTS가 비어도 vector-only 무관 출처보다 lexical 후보를 우선한다', async () => {
    const rowsById = new Map([
      [
        'aql',
        {
          chunkId: 'aql',
          docType: 'help',
          sourcePath: 'apps/frontend/public/help/user/ko/QC_AQL.md',
          menuCode: 'QC_AQL',
          audience: 'user',
          title: 'AQL 기준관리',
          heading: 'AQL 기준관리',
          summary: null,
          content: 'AQL 기준과 검사수준을 관리합니다.',
        },
      ],
      [
        'prod-input',
        {
          chunkId: 'prod-input',
          docType: 'help',
          sourcePath: 'apps/frontend/public/help/user/ko/PROD_INPUT_KIOSK.md',
          menuCode: 'PROD_INPUT_KIOSK',
          audience: 'user',
          title: '실적입력(키오스크)',
          heading: '사용 순서',
          summary: '생산실적 입력 방법',
          content: '생산실적은 작업지시와 작업자를 선택한 뒤 양품수량과 불량수량을 입력해 저장합니다.',
        },
      ],
    ]);
    const db = {
      prepare: jest.fn((sql: string) => {
        if (sql.includes('sqlite_master')) {
          return { get: jest.fn().mockReturnValue({ name: 'ai_knowledge_vec' }) };
        }
        if (sql.includes('FROM ai_knowledge_vec')) {
          return {
            all: jest.fn().mockReturnValue([{ chunkId: 'aql', distance: 0.01 }]),
          };
        }
        if (sql.includes('FROM ai_knowledge_fts')) {
          return {
            all: jest.fn().mockReturnValue([]),
          };
        }
        if (sql.includes('keywords_json') && sql.includes('LIKE')) {
          return {
            all: jest.fn().mockReturnValue([
              {
                chunkId: 'prod-input',
                docType: 'help',
                audience: 'user',
                sourcePath: 'apps/frontend/public/help/user/ko/PROD_INPUT_KIOSK.md',
                title: '실적입력(키오스크)',
                heading: '사용 순서',
                summary: '생산실적 입력 방법',
                keywordsJson: '["생산실적","실적입력","저장"]',
                content: '생산실적은 작업지시와 작업자를 선택한 뒤 양품수량과 불량수량을 입력해 저장합니다.',
              },
            ]),
          };
        }
        if (sql.includes('WHERE chunk_id IN')) {
          return {
            all: jest.fn((...ids: string[]) => ids.map((id) => rowsById.get(id))),
          };
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    };
    const service = new AiKnowledgeService({ embed: jest.fn().mockResolvedValue({ vector: new Float32Array([1]) }) } as any);
    (service as any).db = db;
    (service as any).vectorEnabled = true;

    const result = await service.search(
      '생산실적등록방법을 알려줘',
      { persona: 'user', audience: 'user', language: 'ko' },
      1,
    );

    expect(result[0].menuCode).toBe('PROD_INPUT_KIOSK');
    expect(result[0].sourcePath).toBe('apps/frontend/public/help/user/ko/PROD_INPUT_KIOSK.md');
  });
});

describe('AiKnowledgeService workflow graph', () => {
  function makeServiceWithDb() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    const service = new AiKnowledgeService({ embed: jest.fn() } as any);
    (service as any).db = db;
    (service as any).vectorEnabled = false;
    (service as any).ensureBaseSchema();
    return { service, db };
  }

  it('rebuildWorkflowGraph가 steps를 precedes/requires/produces 엣지로 저장한다', () => {
    const { service, db } = makeServiceWithDb();
    (service as any).rebuildWorkflowGraph([
      {
        workflowId: 'PROD_FLOW',
        title: '생산 흐름',
        sourcePath: 'docs/workflows/prod.md',
        body: '',
        relatedWorkflows: [],
        troubleshooting: [{ symptom: '라벨 발행이 안 됨', causes: ['JOB_ORDER 상태 오류'], resolutions: ['상태 확인'] }],
        steps: [
          { menu: 'PROD_PLAN', requires: [], produces: [] },
          { menu: 'JOB_ORDER', requires: ['PROD_PLAN'], transitions: 'WAITING→RUNNING', produces: [] },
          { menu: 'PROD_INPUT_KIOSK', requires: ['JOB_ORDER=RUNNING'], produces: ['FG_LABEL'] },
        ],
      },
    ]);
    const edges = db.prepare(`SELECT edge_type AS edgeType, from_menu AS fromMenu, to_menu AS toMenu FROM ai_knowledge_graph ORDER BY edge_type, from_menu`).all();
    expect(edges).toContainEqual({ edgeType: 'precedes', fromMenu: 'PROD_PLAN', toMenu: 'JOB_ORDER' });
    expect(edges).toContainEqual({ edgeType: 'precedes', fromMenu: 'JOB_ORDER', toMenu: 'PROD_INPUT_KIOSK' });
    expect(edges).toContainEqual({ edgeType: 'requires', fromMenu: 'JOB_ORDER', toMenu: 'PROD_INPUT_KIOSK' });
    expect(edges).toContainEqual({ edgeType: 'produces', fromMenu: 'PROD_INPUT_KIOSK', toMenu: 'FG_LABEL' });
    const troubles = db.prepare(`SELECT symptom FROM ai_knowledge_troubleshooting`).all();
    expect(troubles).toHaveLength(1);
  });

  it('getWorkflowContext가 선행/후행 메뉴와 단계 위치를 반환한다', () => {
    const { service } = makeServiceWithDb();
    (service as any).rebuildWorkflowGraph([
      {
        workflowId: 'PROD_FLOW', title: '생산 흐름', sourcePath: 'docs/workflows/prod.md', body: '', relatedWorkflows: [], troubleshooting: [],
        steps: [
          { menu: 'PROD_PLAN', requires: [], produces: [] },
          { menu: 'JOB_ORDER', requires: [], produces: [] },
          { menu: 'FG_RECEIVE', requires: ['FG_LABEL'], produces: [] },
        ],
      },
    ]);
    const ctx = service.getWorkflowContext('JOB_ORDER');
    expect(ctx.workflows).toEqual([{ workflowId: 'PROD_FLOW', title: '생산 흐름', stepIndex: 2, totalSteps: 3 }]);
    expect(ctx.prevMenus).toEqual(['PROD_PLAN']);
    expect(ctx.nextMenus).toEqual(['FG_RECEIVE']);
    const ctxLast = service.getWorkflowContext('FG_RECEIVE');
    expect(ctxLast.requires).toEqual(['FG_LABEL']);
    expect(ctxLast.nextMenus).toEqual([]);
  });

  it('searchTroubleshooting이 증상/원인 텍스트를 부분 매칭한다', () => {
    const { service } = makeServiceWithDb();
    (service as any).rebuildWorkflowGraph([
      {
        workflowId: 'PROD_FLOW', title: '생산 흐름', sourcePath: 'docs/workflows/prod.md', body: '', relatedWorkflows: [],
        troubleshooting: [
          { symptom: '라벨 발행이 안 됨', causes: ['작업지시 상태가 RUNNING 아님'], resolutions: ['상태 확인'] },
          { symptom: '입고 수량 불일치', causes: ['박스 스캔 누락'], resolutions: ['재스캔'] },
        ],
        steps: [{ menu: 'PROD_PLAN', requires: [], produces: [] }],
      },
    ]);
    const hits = service.searchTroubleshooting('라벨 발행이 왜 안 되지', 5);
    expect(hits).toHaveLength(1);
    expect(hits[0].symptom).toBe('라벨 발행이 안 됨');
    expect(hits[0].causes).toEqual(['작업지시 상태가 RUNNING 아님']);
  });
});
