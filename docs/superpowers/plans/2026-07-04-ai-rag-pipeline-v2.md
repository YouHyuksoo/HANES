# AI RAG 파이프라인 v2 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI 채팅 답변이 워크플로우 전후관계·문제해결 맥락을 갖도록 워크플로우 그래프 + 맥락주입 청킹 + 질의이해/RRF/리랭크 파이프라인을 구현한다.

**Architecture:** `docs/workflows/*.md`(사람 검수 그래프 단일출처) → reindex 시 SQLite 그래프 테이블 + 청크별 맥락 헤더 생성 → 런타임에 질의이해(LLM)→멀티질의 하이브리드 검색+RRF→그래프 확장(관계를 컨텍스트로 강제 포함)→리랭크(LLM)→구조화 컨텍스트로 답변 생성.

**Tech Stack:** NestJS, better-sqlite3 + sqlite-vec + FTS5, `yaml`(신규 의존성), Jest, Next.js(zustand), Mistral/OpenAI(기존 AiService.complete 재사용).

**Spec:** `docs/superpowers/specs/2026-07-04-ai-rag-pipeline-v2-design.md`

## Global Constraints

- 패키지 매니저는 `pnpm`만 사용. `npm` 금지.
- dev 서버가 떠 있으면 `pnpm build` 금지. typecheck는 `pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false` / `--filter @harness/frontend`.
- `catch (error: unknown)` 유지, 프로덕션 코드에서 `as any` 금지(테스트 mock은 기존 스타일 허용).
- 주석/문서는 한국어, 기존 파일 헤더 주석(`@file`, `@description`) 스타일 유지.
- coordination이 켜져 있으므로(enabled=true) 편집 전 LOCKS.md 등록, 협업 문서 변경은 기능 변경과 별도 커밋.
- **미커밋 작업 트리 보존**: `ai-knowledge.service.ts`의 lexical 검색(buildLexicalTerms 등), `AiChatPanel.tsx`/`aiChatStore.ts`의 미커밋 변경은 그대로 두고 그 위에 쌓는다. 되돌리기 금지.
- **스펙 대비 의도적 변경 1건**: 스펙 6장의 "기존 0.6/0.3 가중치 폐기"는 적용하지 않는다. 단일 질의 내부 융합(vector/FTS/lexical 점수)은 미커밋 개선+테스트가 이미 튜닝해 놓았으므로 유지하고, **RRF는 멀티 질의 결과 융합에만 적용**한다. (스펙 문서에 반영 완료)
- git commit 메시지가 여러 줄이면 임시파일 + `-F` 사용. `git add`는 파일 단위(디렉토리 금지).

## File Structure

```
apps/backend/src/modules/ai-knowledge/
  workflow-parser.ts              (신규) workflows md frontmatter 파싱+검증
  workflow-parser.spec.ts         (신규)
  markdown-chunker.ts             (수정) contextHeader 필드 + withContextHeader()
  markdown-chunker.spec.ts        (신규) 헤더 주입 시 chunkId 재해시 검증
  ai-knowledge.service.ts         (수정) 그래프 테이블, 맥락 헤더, 그래프 조회 API
  ai-knowledge.service.spec.ts    (수정) 그래프 확장 조회 테스트 추가
apps/backend/src/modules/ai/
  knowledge-pipeline.service.ts       (신규) 질의이해→RRF→그래프확장→리랭크→구조화
  knowledge-pipeline.service.spec.ts  (신규)
  ai-sql.service.ts               (수정) process()가 파이프라인 사용
  ai.module.ts                    (수정) KnowledgePipelineService provider 등록
docs/workflows/definitions/       (신규) 워크플로우 정의 문서 5개(초안→사용자 검수)
tools/help-frontmatter-audit.mjs  (신규) 도움말 frontmatter 누락 점검
apps/frontend/src/components/ai/AiChatPanel.tsx  (수정) 임베딩 degrade 경고 배지
apps/frontend/src/locales/{ko,en,zh,vi}/translation.json (수정) 배지 문구 4개 언어
docs/reports/ai-rag-golden-questions.md (신규) 평가 질문 세트
```

---

### Task 0: coordination 등록

**Files:**
- Modify: `.ai-coordination/TASKS.md`
- Modify: `.ai-coordination/LOCKS.md`

- [ ] **Step 1: TASKS.md의 `## Active Tasks` 아래에 작업 추가**

```md
## T-AI-RAG-V2 AI RAG 파이프라인 v2 (워크플로우 그래프+맥락 청킹+풀 파이프라인)
status: IN_PROGRESS
owner: claude
role: implementer
scope:
- docs/superpowers/specs/2026-07-04-ai-rag-pipeline-v2-design.md 구현
files:
- (LOCKS.md T-AI-RAG-V2 참조)
verification:
- pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/*.spec.ts src/modules/ai/knowledge-pipeline.service.spec.ts
- pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
- pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
review:
- needs-review
notes:
- 작업 트리의 미커밋 lexical 검색 개선(ai-knowledge.service.ts 등)은 보존하고 그 위에 구현.
```

- [ ] **Step 2: LOCKS.md의 `## Active Locks` 아래에 lock 추가**

```md
## T-AI-RAG-V2
status: active
owner: claude
role: implementer
expires: 2026-07-06T00:00:00Z
files:
- apps/backend/src/modules/ai-knowledge/workflow-parser.ts
- apps/backend/src/modules/ai-knowledge/workflow-parser.spec.ts
- apps/backend/src/modules/ai-knowledge/markdown-chunker.ts
- apps/backend/src/modules/ai-knowledge/markdown-chunker.spec.ts
- apps/backend/src/modules/ai-knowledge/ai-knowledge.service.ts
- apps/backend/src/modules/ai-knowledge/ai-knowledge.service.spec.ts
- apps/backend/src/modules/ai/knowledge-pipeline.service.ts
- apps/backend/src/modules/ai/knowledge-pipeline.service.spec.ts
- apps/backend/src/modules/ai/ai-sql.service.ts
- apps/backend/src/modules/ai/ai.module.ts
- apps/backend/package.json
- docs/workflows/
- tools/help-frontmatter-audit.mjs
- apps/frontend/src/components/ai/AiChatPanel.tsx
- apps/frontend/src/locales/ko/translation.json
- apps/frontend/src/locales/en/translation.json
- apps/frontend/src/locales/zh/translation.json
- apps/frontend/src/locales/vi/translation.json
notes:
- AI RAG v2. 미커밋 lexical 개선 보존.
```

- [ ] **Step 3: 커밋 (협업 문서만)**

```bash
git add .ai-coordination/TASKS.md .ai-coordination/LOCKS.md
git commit -m "chore(coordination): T-AI-RAG-V2 작업 등록"
```

---

### Task 1: workflow 문서 파서

**Files:**
- Modify: `apps/backend/package.json` (`yaml` 의존성 추가)
- Create: `apps/backend/src/modules/ai-knowledge/workflow-parser.ts`
- Test: `apps/backend/src/modules/ai-knowledge/workflow-parser.spec.ts`

**Interfaces:**
- Produces: `parseWorkflowDoc(raw: string, sourcePath: string): WorkflowParseResult`
  - `WorkflowParseResult = { doc: WorkflowDoc | null; errors: string[] }`
  - `WorkflowDoc = { workflowId: string; title: string; steps: WorkflowStep[]; troubleshooting: WorkflowTrouble[]; relatedWorkflows: string[]; sourcePath: string; body: string }`
  - `WorkflowStep = { menu: string; requires: string[]; transitions?: string; produces: string[] }`
  - `WorkflowTrouble = { symptom: string; causes: string[]; resolutions: string[] }`

- [ ] **Step 1: yaml 의존성 설치**

```bash
pnpm.cmd --filter @harness/backend add yaml
```

Expected: `apps/backend/package.json`의 dependencies에 `"yaml": "^2..."` 추가됨.

- [ ] **Step 2: 실패하는 테스트 작성**

`apps/backend/src/modules/ai-knowledge/workflow-parser.spec.ts`:

```ts
/**
 * @file src/modules/ai-knowledge/workflow-parser.spec.ts
 * @description docs/workflows/*.md frontmatter 파싱/검증 단위 테스트
 */
import { parseWorkflowDoc } from './workflow-parser';

const VALID_DOC = `---
workflowId: PROD_FLOW
title: 생산계획→작업지시→투입→입고 흐름
steps:
  - menu: PROD_PLAN
  - menu: JOB_ORDER
    requires: [PROD_PLAN]
    transitions: "WAITING→RUNNING"
  - menu: PROD_INPUT_KIOSK
    requires: [JOB_ORDER=RUNNING]
    produces: [FG_LABEL]
  - menu: FG_RECEIVE
    requires: [FG_LABEL, BOX_NO]
troubleshooting:
  - symptom: "라벨 발행이 안 됨"
    causes: [JOB_ORDER 상태가 RUNNING 아님, BOM 미등록]
    resolutions: [작업지시 화면에서 상태 확인]
relatedWorkflows: [QC_FLOW]
---
## 단계별 설명
본문입니다.
`;

describe('parseWorkflowDoc', () => {
  it('정상 문서를 파싱해 steps/troubleshooting/related를 구조화한다', () => {
    const { doc, errors } = parseWorkflowDoc(VALID_DOC, 'docs/workflows/production.md');
    expect(errors).toEqual([]);
    expect(doc?.workflowId).toBe('PROD_FLOW');
    expect(doc?.steps).toHaveLength(4);
    expect(doc?.steps[1]).toEqual({
      menu: 'JOB_ORDER',
      requires: ['PROD_PLAN'],
      transitions: 'WAITING→RUNNING',
      produces: [],
    });
    expect(doc?.steps[2].produces).toEqual(['FG_LABEL']);
    expect(doc?.troubleshooting[0].symptom).toBe('라벨 발행이 안 됨');
    expect(doc?.troubleshooting[0].causes).toHaveLength(2);
    expect(doc?.relatedWorkflows).toEqual(['QC_FLOW']);
    expect(doc?.body).toContain('단계별 설명');
  });

  it('workflowId 누락 시 doc=null과 오류를 반환한다', () => {
    const raw = VALID_DOC.replace('workflowId: PROD_FLOW\n', '');
    const { doc, errors } = parseWorkflowDoc(raw, 'docs/workflows/production.md');
    expect(doc).toBeNull();
    expect(errors.some((e) => e.includes('workflowId'))).toBe(true);
  });

  it('steps가 비어 있으면 오류를 반환한다', () => {
    const raw = `---\nworkflowId: X_FLOW\ntitle: 제목\nsteps: []\n---\n본문`;
    const { doc, errors } = parseWorkflowDoc(raw, 'docs/workflows/x.md');
    expect(doc).toBeNull();
    expect(errors.some((e) => e.includes('steps'))).toBe(true);
  });

  it('frontmatter가 없으면 오류를 반환한다', () => {
    const { doc, errors } = parseWorkflowDoc('# 그냥 마크다운', 'docs/workflows/y.md');
    expect(doc).toBeNull();
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/workflow-parser.spec.ts
```

Expected: FAIL — `Cannot find module './workflow-parser'`

- [ ] **Step 4: 구현**

`apps/backend/src/modules/ai-knowledge/workflow-parser.ts`:

```ts
/**
 * @file src/modules/ai-knowledge/workflow-parser.ts
 * @description docs/workflows/*.md 워크플로우 정의 문서 파서. frontmatter(YAML)를 그래프 구조로 검증/변환한다.
 */
import { parse as parseYaml } from 'yaml';

export interface WorkflowStep {
  menu: string;
  requires: string[];
  transitions?: string;
  produces: string[];
}

export interface WorkflowTrouble {
  symptom: string;
  causes: string[];
  resolutions: string[];
}

export interface WorkflowDoc {
  workflowId: string;
  title: string;
  steps: WorkflowStep[];
  troubleshooting: WorkflowTrouble[];
  relatedWorkflows: string[];
  sourcePath: string;
  body: string;
}

export interface WorkflowParseResult {
  doc: WorkflowDoc | null;
  errors: string[];
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

export function parseWorkflowDoc(raw: string, sourcePath: string): WorkflowParseResult {
  const errors: string[] = [];
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { doc: null, errors: [`${sourcePath}: frontmatter(---)가 없습니다.`] };
  }

  let meta: Record<string, unknown>;
  try {
    const parsed = parseYaml(match[1]);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { doc: null, errors: [`${sourcePath}: frontmatter가 객체가 아닙니다.`] };
    }
    meta = parsed as Record<string, unknown>;
  } catch (error: unknown) {
    return { doc: null, errors: [`${sourcePath}: YAML 파싱 실패 — ${error instanceof Error ? error.message : String(error)}`] };
  }

  const workflowId = typeof meta.workflowId === 'string' ? meta.workflowId.trim() : '';
  if (!workflowId) errors.push(`${sourcePath}: workflowId가 필요합니다.`);
  else if (!/^[A-Z][A-Z0-9_]*$/.test(workflowId)) errors.push(`${sourcePath}: workflowId는 대문자 스네이크여야 합니다: ${workflowId}`);

  const title = typeof meta.title === 'string' ? meta.title.trim() : '';
  if (!title) errors.push(`${sourcePath}: title이 필요합니다.`);

  const rawSteps = Array.isArray(meta.steps) ? meta.steps : [];
  const steps: WorkflowStep[] = [];
  rawSteps.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`${sourcePath}: steps[${index}]가 객체가 아닙니다.`);
      return;
    }
    const step = entry as Record<string, unknown>;
    const menu = typeof step.menu === 'string' ? step.menu.trim() : '';
    if (!menu) {
      errors.push(`${sourcePath}: steps[${index}].menu가 필요합니다.`);
      return;
    }
    steps.push({
      menu,
      requires: toStringArray(step.requires),
      transitions: typeof step.transitions === 'string' && step.transitions.trim() ? step.transitions.trim() : undefined,
      produces: toStringArray(step.produces),
    });
  });
  if (steps.length === 0) errors.push(`${sourcePath}: steps에 최소 1개 단계가 필요합니다.`);

  const rawTroubles = Array.isArray(meta.troubleshooting) ? meta.troubleshooting : [];
  const troubleshooting: WorkflowTrouble[] = [];
  rawTroubles.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`${sourcePath}: troubleshooting[${index}]가 객체가 아닙니다.`);
      return;
    }
    const trouble = entry as Record<string, unknown>;
    const symptom = typeof trouble.symptom === 'string' ? trouble.symptom.trim() : '';
    if (!symptom) {
      errors.push(`${sourcePath}: troubleshooting[${index}].symptom이 필요합니다.`);
      return;
    }
    troubleshooting.push({
      symptom,
      causes: toStringArray(trouble.causes),
      resolutions: toStringArray(trouble.resolutions),
    });
  });

  if (errors.length > 0) return { doc: null, errors };

  return {
    doc: {
      workflowId,
      title,
      steps,
      troubleshooting,
      relatedWorkflows: toStringArray(meta.relatedWorkflows),
      sourcePath: sourcePath.replace(/\\/g, '/'),
      body: (match[2] ?? '').trim(),
    },
    errors,
  };
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/workflow-parser.spec.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/package.json pnpm-lock.yaml apps/backend/src/modules/ai-knowledge/workflow-parser.ts apps/backend/src/modules/ai-knowledge/workflow-parser.spec.ts
git commit -m "feat(ai-knowledge): 워크플로우 정의 문서 파서 추가"
```

---

### Task 2: 그래프 테이블 + reindex 통합 + 그래프 조회

**Files:**
- Modify: `apps/backend/src/modules/ai-knowledge/ai-knowledge.service.ts`
- Test: `apps/backend/src/modules/ai-knowledge/ai-knowledge.service.spec.ts` (추가)

**Interfaces:**
- Consumes: Task 1의 `parseWorkflowDoc`
- Produces (AiKnowledgeService의 public 메서드 — Task 4가 사용):
  - `getWorkflowContext(menuCode: string): WorkflowMenuContext`
    - `WorkflowMenuContext = { workflows: Array<{ workflowId: string; title: string; stepIndex: number; totalSteps: number }>; prevMenus: string[]; nextMenus: string[]; requires: string[] }`
  - `getMenuOverviewChunks(menuCodes: string[], audience: string, limit: number): KnowledgeSearchResult[]`
  - `getWorkflowDocChunks(workflowIds: string[], limit: number): KnowledgeSearchResult[]`
  - `searchTroubleshooting(query: string, limit: number): Array<{ workflowId: string; symptom: string; causes: string[]; resolutions: string[] }>`
  - `KnowledgeReindexResult`에 `workflowErrors: string[]`, `workflowWarnings: string[]`, `graphEdges: number` 필드 추가

- [ ] **Step 1: 실패하는 테스트 추가**

`ai-knowledge.service.spec.ts` 맨 아래(기존 describe 밖)에 추가. **in-memory better-sqlite3 실DB**를 쓴다(그래프 로직은 SQL이 핵심이라 mock이 무의미).

```ts
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/ai-knowledge.service.spec.ts
```

Expected: 신규 3개 FAIL (`rebuildWorkflowGraph is not a function`), 기존 4개 PASS 유지.

- [ ] **Step 3: 스키마 + 그래프 재구축 + 조회 구현**

`ai-knowledge.service.ts` 수정:

(a) import에 추가:

```ts
import { WorkflowDoc, parseWorkflowDoc } from './workflow-parser';
```

(b) `DEFAULT_KNOWLEDGE_TARGETS`에 추가 (docs/plans 항목 다음 줄):

```ts
  { path: 'docs/workflows', docType: 'workflow' },
```

(c) `inferDocType`에 분기 추가 (`docs/plans` 분기 다음):

```ts
    if (targetPath.startsWith('docs/workflows')) return 'workflow';
```

(d) 타입/인터페이스 추가 (KnowledgeSearchResult 아래):

```ts
export interface WorkflowMenuContext {
  workflows: Array<{ workflowId: string; title: string; stepIndex: number; totalSteps: number }>;
  prevMenus: string[];
  nextMenus: string[];
  requires: string[];
}

export interface TroubleshootingHit {
  workflowId: string;
  symptom: string;
  causes: string[];
  resolutions: string[];
}
```

(e) `KnowledgeReindexResult`에 필드 추가:

```ts
  workflowErrors: string[];
  workflowWarnings: string[];
  graphEdges: number;
```

(f) `ensureBaseSchema()`의 `db.exec` 블록 끝(ai_knowledge_meta 정의 뒤)에 테이블 추가:

```sql
      CREATE TABLE IF NOT EXISTS ai_knowledge_graph (
        workflow_id TEXT NOT NULL,
        workflow_title TEXT NOT NULL,
        from_menu TEXT NOT NULL,
        to_menu TEXT NOT NULL,
        edge_type TEXT NOT NULL,
        detail TEXT,
        step_index INTEGER,
        PRIMARY KEY (workflow_id, from_menu, to_menu, edge_type)
      );
      CREATE TABLE IF NOT EXISTS ai_knowledge_workflow_steps (
        workflow_id TEXT NOT NULL,
        workflow_title TEXT NOT NULL,
        source_path TEXT NOT NULL,
        menu_code TEXT NOT NULL,
        step_index INTEGER NOT NULL,
        total_steps INTEGER NOT NULL,
        requires_json TEXT NOT NULL,
        PRIMARY KEY (workflow_id, menu_code)
      );
      CREATE TABLE IF NOT EXISTS ai_knowledge_troubleshooting (
        workflow_id TEXT NOT NULL,
        symptom TEXT NOT NULL,
        causes_json TEXT NOT NULL,
        resolutions_json TEXT NOT NULL,
        PRIMARY KEY (workflow_id, symptom)
      );
```

그리고 `ensureBaseSchema()` 끝에 기존 DB 마이그레이션 가드 추가:

```ts
    try {
      db.exec(`ALTER TABLE ai_knowledge_chunks ADD COLUMN context_header TEXT`);
    } catch {
      // 이미 컬럼이 있으면 무시한다.
    }
```

(g) 그래프 재구축 (private, reindex에서 호출):

```ts
  /** workflows 문서에서 그래프/단계/트러블슈팅 테이블을 전량 재구축한다. */
  private rebuildWorkflowGraph(docs: WorkflowDoc[]): number {
    const db = this.db!;
    db.exec(`DELETE FROM ai_knowledge_graph; DELETE FROM ai_knowledge_workflow_steps; DELETE FROM ai_knowledge_troubleshooting;`);
    const insertEdge = db.prepare(`
      INSERT OR REPLACE INTO ai_knowledge_graph(workflow_id, workflow_title, from_menu, to_menu, edge_type, detail, step_index)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertStep = db.prepare(`
      INSERT OR REPLACE INTO ai_knowledge_workflow_steps(workflow_id, workflow_title, source_path, menu_code, step_index, total_steps, requires_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertTrouble = db.prepare(`
      INSERT OR REPLACE INTO ai_knowledge_troubleshooting(workflow_id, symptom, causes_json, resolutions_json)
      VALUES (?, ?, ?, ?)
    `);
    let edges = 0;
    for (const doc of docs) {
      doc.steps.forEach((step, index) => {
        insertStep.run(doc.workflowId, doc.title, doc.sourcePath, step.menu, index + 1, doc.steps.length, JSON.stringify(step.requires));
        if (index > 0) {
          insertEdge.run(doc.workflowId, doc.title, doc.steps[index - 1].menu, step.menu, 'precedes', step.transitions ?? null, index + 1);
          edges += 1;
        }
        for (const requirement of step.requires) {
          const [reqMenu, reqState] = requirement.split('=');
          insertEdge.run(doc.workflowId, doc.title, reqMenu.trim(), step.menu, 'requires', reqState?.trim() ?? null, index + 1);
          edges += 1;
        }
        for (const artifact of step.produces) {
          insertEdge.run(doc.workflowId, doc.title, step.menu, artifact, 'produces', null, index + 1);
          edges += 1;
        }
      });
      for (const trouble of doc.troubleshooting) {
        insertTrouble.run(doc.workflowId, trouble.symptom, JSON.stringify(trouble.causes), JSON.stringify(trouble.resolutions));
      }
    }
    return edges;
  }
```

(h) 그래프 조회 public 메서드들:

```ts
  /** 메뉴가 속한 워크플로우와 선행/후행 메뉴를 반환한다 (그래프 1홉). */
  getWorkflowContext(menuCode: string): WorkflowMenuContext {
    const db = this.db!;
    const stepRows = db.prepare(`
      SELECT workflow_id AS workflowId, workflow_title AS title, step_index AS stepIndex, total_steps AS totalSteps, requires_json AS requiresJson
      FROM ai_knowledge_workflow_steps
      WHERE menu_code = ?
      ORDER BY workflow_id
    `).all(menuCode) as Array<{ workflowId: string; title: string; stepIndex: number; totalSteps: number; requiresJson: string }>;
    const prevRows = db.prepare(`
      SELECT DISTINCT from_menu AS menu FROM ai_knowledge_graph WHERE to_menu = ? AND edge_type = 'precedes'
    `).all(menuCode) as Array<{ menu: string }>;
    const nextRows = db.prepare(`
      SELECT DISTINCT to_menu AS menu FROM ai_knowledge_graph WHERE from_menu = ? AND edge_type = 'precedes'
    `).all(menuCode) as Array<{ menu: string }>;
    const requires = new Set<string>();
    for (const row of stepRows) {
      for (const item of this.parseRelatedMenuCodes(row.requiresJson)) requires.add(item);
    }
    return {
      workflows: stepRows.map(({ workflowId, title, stepIndex, totalSteps }) => ({ workflowId, title, stepIndex, totalSteps })),
      prevMenus: prevRows.map((row) => row.menu),
      nextMenus: nextRows.map((row) => row.menu),
      requires: Array.from(requires),
    };
  }

  /** 메뉴들의 대표(첫 번째) 청크를 audience 우선으로 반환한다 — 그래프 확장 컨텍스트용. */
  getMenuOverviewChunks(menuCodes: string[], audience: string, limit: number): KnowledgeSearchResult[] {
    if (menuCodes.length === 0) return [];
    const db = this.db!;
    const placeholders = menuCodes.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT chunk_id AS chunkId, doc_type AS docType, source_path AS sourcePath, menu_code AS menuCode, audience,
             title, heading, summary, content
      FROM ai_knowledge_chunks
      WHERE menu_code IN (${placeholders}) AND doc_type = 'help'
      ORDER BY menu_code, CASE WHEN audience = ? THEN 0 ELSE 1 END, chunk_id
    `).all(...menuCodes, audience) as Omit<KnowledgeSearchResult, 'score'>[];
    const seen = new Set<string>();
    const out: KnowledgeSearchResult[] = [];
    for (const row of rows) {
      const key = row.menuCode ?? row.sourcePath;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ ...row, score: 0 });
      if (out.length >= limit) break;
    }
    return out;
  }

  /** 워크플로우 정의 문서 자체의 청크를 반환한다 (workflow_steps의 source_path로 매칭). */
  getWorkflowDocChunks(workflowIds: string[], limit: number): KnowledgeSearchResult[] {
    if (workflowIds.length === 0) return [];
    const db = this.db!;
    const idPlaceholders = workflowIds.map(() => '?').join(',');
    const pathRows = db.prepare(`
      SELECT DISTINCT source_path AS sourcePath FROM ai_knowledge_workflow_steps WHERE workflow_id IN (${idPlaceholders})
    `).all(...workflowIds) as Array<{ sourcePath: string }>;
    if (pathRows.length === 0) return [];
    const pathPlaceholders = pathRows.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT chunk_id AS chunkId, doc_type AS docType, source_path AS sourcePath, menu_code AS menuCode, audience,
             title, heading, summary, content
      FROM ai_knowledge_chunks
      WHERE doc_type = 'workflow' AND source_path IN (${pathPlaceholders})
      LIMIT ?
    `).all(...pathRows.map((row) => row.sourcePath), limit) as Omit<KnowledgeSearchResult, 'score'>[];
    return rows.map((row) => ({ ...row, score: 0 }));
  }

  /** 증상/원인 텍스트 부분 매칭 — 문제해결 의도 질문용. */
  searchTroubleshooting(query: string, limit: number): TroubleshootingHit[] {
    const db = this.db!;
    const terms = this.buildLexicalTerms(query);
    if (terms.length === 0) return [];
    const rows = db.prepare(`
      SELECT workflow_id AS workflowId, symptom, causes_json AS causesJson, resolutions_json AS resolutionsJson
      FROM ai_knowledge_troubleshooting
    `).all() as Array<{ workflowId: string; symptom: string; causesJson: string; resolutionsJson: string }>;
    const scored = rows
      .map((row) => {
        const haystack = `${row.symptom}\n${row.causesJson}`;
        const hits = terms.filter((term) => haystack.includes(term));
        return { row, score: hits.reduce((sum, term) => sum + Math.min(term.length, 6), 0) };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    return scored.map(({ row }) => ({
      workflowId: row.workflowId,
      symptom: row.symptom,
      causes: this.parseRelatedMenuCodes(row.causesJson),
      resolutions: this.parseRelatedMenuCodes(row.resolutionsJson),
    }));
  }
```

참고: `parseRelatedMenuCodes`는 이름과 달리 "JSON 배열 문자열 → trim된 string[]" 범용 함수라 causes/resolutions 파싱에 그대로 재사용한다.

(i) `reindex()` 수정 — 문서 수집 후 워크플로우 파싱을 끼워 넣는다. `const chunks = documents.flatMap(...)` 줄을 다음으로 교체:

```ts
    const workflowErrors: string[] = [];
    const workflowWarnings: string[] = [];
    const workflowDocs: WorkflowDoc[] = [];
    for (const doc of documents.filter((d) => d.docType === 'workflow')) {
      const { doc: parsed, errors } = parseWorkflowDoc(doc.raw, doc.sourcePath);
      if (parsed) workflowDocs.push(parsed);
      workflowErrors.push(...errors);
    }
    const chunks = documents.flatMap((doc) => chunkMarkdown(doc));
    const helpMenuCodes = new Set(chunks.filter((c) => c.menuCode).map((c) => c.menuCode as string));
    for (const wf of workflowDocs) {
      for (const step of wf.steps) {
        if (!helpMenuCodes.has(step.menu)) {
          workflowWarnings.push(`${wf.sourcePath}: 도움말에 없는 메뉴코드 ${step.menu} (오타 확인)`);
        }
      }
    }
```

그리고 `tx()` 트랜잭션 내부 마지막(`last_reindex_at` 저장 직전)에 그래프 재구축 추가:

```ts
      graphEdges = this.rebuildWorkflowGraph(workflowDocs);
```

(트랜잭션 앞에 `let graphEdges = 0;` 선언), return 객체에 `workflowErrors, workflowWarnings, graphEdges` 추가.

- [ ] **Step 4: 테스트/타입 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/ai-knowledge.service.spec.ts
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: 기존 4 + 신규 3 = 7 PASS, 타입 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/ai-knowledge/ai-knowledge.service.ts apps/backend/src/modules/ai-knowledge/ai-knowledge.service.spec.ts
git commit -m "feat(ai-knowledge): 워크플로우 그래프 테이블 및 조회 API 추가"
```

---

### Task 3: 맥락 주입 청킹

**Files:**
- Modify: `apps/backend/src/modules/ai-knowledge/markdown-chunker.ts`
- Create: `apps/backend/src/modules/ai-knowledge/markdown-chunker.spec.ts`
- Modify: `apps/backend/src/modules/ai-knowledge/ai-knowledge.service.ts`

**Interfaces:**
- Produces: `KnowledgeChunk.contextHeader?: string`, `withContextHeader(chunk: KnowledgeChunk, header: string): KnowledgeChunk` (chunkId 재해시 포함)
- reindex가 청크별 헤더를 생성해 embedding/FTS 입력에 주입. `content`(표시용)는 원본 유지.

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/backend/src/modules/ai-knowledge/markdown-chunker.spec.ts`:

```ts
/**
 * @file src/modules/ai-knowledge/markdown-chunker.spec.ts
 * @description 맥락 헤더 주입 시 chunkId 재해시/원본 보존 검증
 */
import { chunkMarkdown, withContextHeader } from './markdown-chunker';

const RAW = `---
menuCode: FG_RECEIVE
audience: user
title: 박스입고
---
## 입고 처리
박스를 스캔해 입고합니다.
`;

describe('withContextHeader', () => {
  it('contextHeader를 설정하고 chunkId를 재해시하되 content는 원본을 유지한다', () => {
    const [chunk] = chunkMarkdown({ sourcePath: 'help/user/ko/FG_RECEIVE.md', docType: 'help', raw: RAW });
    const header = '[박스입고(FG_RECEIVE) 사용자 도움말 | PROD_FLOW 4/4단계 | 선행: 자재투입]';
    const updated = withContextHeader(chunk, header);
    expect(updated.contextHeader).toBe(header);
    expect(updated.content).toBe(chunk.content);
    expect(updated.chunkId).not.toBe(chunk.chunkId);
    expect(updated.chunkId.split(':').slice(0, -1).join(':')).toBe(chunk.chunkId.split(':').slice(0, -1).join(':'));
  });

  it('같은 헤더면 같은 chunkId를 재생성한다 (임베딩 캐시 안정성)', () => {
    const [chunk] = chunkMarkdown({ sourcePath: 'help/user/ko/FG_RECEIVE.md', docType: 'help', raw: RAW });
    const a = withContextHeader(chunk, '[헤더]');
    const b = withContextHeader(chunk, '[헤더]');
    expect(a.chunkId).toBe(b.chunkId);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/markdown-chunker.spec.ts
```

Expected: FAIL — `withContextHeader is not exported`

- [ ] **Step 3: chunker 구현**

`markdown-chunker.ts`의 `KnowledgeChunk` 인터페이스에 필드 추가:

```ts
  /** 검색(임베딩/FTS) 입력에만 붙는 문서/워크플로우 맥락 헤더. 표시용 content에는 포함하지 않는다. */
  contextHeader?: string;
```

파일 끝에 함수 추가:

```ts
/**
 * 청크에 맥락 헤더를 설정하고 chunkId 해시 suffix를 재계산한다.
 * 헤더가 바뀌면(워크플로우 문서 수정 등) chunkId가 바뀌어 임베딩 캐시가 자연 무효화된다.
 */
export function withContextHeader(chunk: KnowledgeChunk, header: string): KnowledgeChunk {
  const idBase = chunk.chunkId.split(':').slice(0, -1).join(':');
  return {
    ...chunk,
    contextHeader: header,
    chunkId: `${idBase}:${sha256(`${header}\n${chunk.content}`).slice(0, 10)}`,
  };
}
```

- [ ] **Step 4: chunker 테스트 통과 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/markdown-chunker.spec.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: reindex에 헤더 생성 통합**

`ai-knowledge.service.ts` 수정:

(a) import 수정:

```ts
import { KnowledgeChunk, chunkMarkdown, withContextHeader } from './markdown-chunker';
```

(b) 헤더 생성 private 메서드 추가:

```ts
  /** 규칙 기반 맥락 헤더. 워크플로우 그래프와 frontmatter만 사용한다 (LLM 불필요). */
  private buildContextHeader(chunk: KnowledgeChunk, workflowDocs: WorkflowDoc[]): string {
    const parts: string[] = [];
    if (chunk.docType === 'workflow') {
      const wf = workflowDocs.find((doc) => doc.sourcePath === chunk.sourcePath);
      parts.push(`워크플로우 정의: ${wf?.title ?? chunk.title ?? ''}${wf ? ` (${wf.workflowId}, ${wf.steps.length}단계)` : ''}`);
    } else {
      const audienceLabel = chunk.audience === 'operator' ? '운영자 도움말' : chunk.audience === 'user' ? '사용자 도움말' : chunk.docType;
      parts.push(`${chunk.title ?? ''}${chunk.menuCode ? `(${chunk.menuCode})` : ''} ${audienceLabel}`.trim());
      if (chunk.menuCode) {
        for (const wf of workflowDocs) {
          const index = wf.steps.findIndex((step) => step.menu === chunk.menuCode);
          if (index === -1) continue;
          const prev = index > 0 ? wf.steps[index - 1].menu : null;
          const next = index < wf.steps.length - 1 ? wf.steps[index + 1].menu : null;
          parts.push(`${wf.title} ${index + 1}/${wf.steps.length}단계${prev ? ` | 선행: ${prev}` : ''}${next ? ` | 후행: ${next}` : ''}`);
        }
      }
    }
    const joined = parts.filter(Boolean).join(' | ');
    return joined ? `[${joined}]` : '';
  }
```

(c) `reindex()`에서 청킹 직후(Task 2에서 넣은 helpMenuCodes 계산 이전에 chunks를 확정해야 하므로, `const chunks = documents.flatMap(...)` 줄을) 다음으로 교체:

```ts
    const chunks = documents.flatMap((doc) => chunkMarkdown(doc)).map((chunk) => {
      const header = this.buildContextHeader(chunk, workflowDocs);
      return header ? withContextHeader(chunk, header) : chunk;
    });
```

(d) `embeddingText()`를 헤더 포함으로 교체:

```ts
  private embeddingText(chunk: KnowledgeChunk): string {
    return [chunk.contextHeader, chunk.title, chunk.heading, chunk.summary, chunk.keywords.join(' '), chunk.content]
      .filter(Boolean)
      .join('\n');
  }
```

(e) reindex의 `insertChunk.run(...)`에 context_header 저장 — INSERT 컬럼 목록에 `context_header` 추가하고 값 바인딩에 `chunk.contextHeader ?? null` 추가 (updated_at 앞):

```ts
      const insertChunk = db.prepare(`
        INSERT INTO ai_knowledge_chunks(
          chunk_id, doc_type, source_path, source_hash, language, menu_code, audience, title, heading, summary,
          keywords_json, related_json, content, token_estimate, context_header, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
```

```ts
          chunk.tokenEstimate,
          chunk.contextHeader ?? null,
          now,
```

(f) FTS 입력에 헤더 반영 — `insertFts.run(...)` 줄을 다음으로 교체:

```ts
        insertFts.run(
          chunk.chunkId,
          chunk.title ?? '',
          chunk.heading ?? '',
          [chunk.summary ?? '', chunk.contextHeader ?? ''].filter(Boolean).join('\n'),
          chunk.keywords.join(' '),
          chunk.content,
        );
```

- [ ] **Step 6: 전체 ai-knowledge 테스트 + 타입 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai-knowledge/markdown-chunker.spec.ts src/modules/ai-knowledge/ai-knowledge.service.spec.ts src/modules/ai-knowledge/workflow-parser.spec.ts
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: 전부 PASS, 타입 0 errors.

- [ ] **Step 7: 커밋**

```bash
git add apps/backend/src/modules/ai-knowledge/markdown-chunker.ts apps/backend/src/modules/ai-knowledge/markdown-chunker.spec.ts apps/backend/src/modules/ai-knowledge/ai-knowledge.service.ts
git commit -m "feat(ai-knowledge): 청크 맥락 헤더 주입 (contextual chunking)"
```

---

### Task 4: 런타임 파이프라인 서비스

**Files:**
- Create: `apps/backend/src/modules/ai/knowledge-pipeline.service.ts`
- Test: `apps/backend/src/modules/ai/knowledge-pipeline.service.spec.ts`
- Modify: `apps/backend/src/modules/ai/ai.module.ts` (provider 등록)

**Interfaces:**
- Consumes: `AiService.complete(messages): Promise<string>`, Task 2의 `AiKnowledgeService` public 메서드들, `KnowledgeSearchContext`/`KnowledgeSearchResult`
- Produces: `KnowledgePipelineService.retrieve(userMessage: string, context?: AiKnowledgeContextDto): Promise<KnowledgePipelineResult>`
  - `KnowledgePipelineResult = { chunks: KnowledgeSearchResult[]; prompt: string; intent: KnowledgeIntent }`
  - `KnowledgeIntent = 'usage' | 'workflow' | 'troubleshoot' | 'engineer'`

- [ ] **Step 1: 실패하는 테스트 작성**

`apps/backend/src/modules/ai/knowledge-pipeline.service.spec.ts`:

```ts
/**
 * @file src/modules/ai/knowledge-pipeline.service.spec.ts
 * @description 질의이해→RRF→그래프확장→리랭크 파이프라인 단위 테스트 (LLM/검색 mock)
 */
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
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai/knowledge-pipeline.service.spec.ts
```

Expected: FAIL — `Cannot find module './knowledge-pipeline.service'`

- [ ] **Step 3: 구현**

`apps/backend/src/modules/ai/knowledge-pipeline.service.ts`:

```ts
/**
 * @file src/modules/ai/knowledge-pipeline.service.ts
 * @description 지식 검색 풀 파이프라인: 질의이해(LLM) → 멀티질의 하이브리드 검색+RRF → 그래프 확장 → 리랭크(LLM) → 구조화 컨텍스트.
 *
 * 모든 LLM 단계는 실패해도 폴백으로 진행한다 — 파이프라인 오류가 채팅 실패로 전파되지 않는다.
 */
import { Injectable, Logger } from '@nestjs/common';
import { AiService } from './ai.service';
import {
  AiKnowledgeService,
  KnowledgeSearchResult,
  TroubleshootingHit,
} from '../ai-knowledge/ai-knowledge.service';
import { AiKnowledgeContextDto } from './dto/ai-chat.dto';

export type KnowledgeIntent = 'usage' | 'workflow' | 'troubleshoot' | 'engineer';

export interface KnowledgePipelineResult {
  chunks: KnowledgeSearchResult[];
  prompt: string;
  intent: KnowledgeIntent;
}

interface QueryUnderstanding {
  intent: KnowledgeIntent;
  queries: string[];
  menus: string[];
}

const UNDERSTAND_PROMPT = `당신은 MES 도움말 검색을 위한 질의 분석기입니다. 사용자 질문을 분석해 JSON만 출력하세요.
{"intent":"usage|workflow|troubleshoot|engineer","queries":["검색질의1","검색질의2"],"menus":["언급된 메뉴코드"]}
- intent: usage=단일 화면 사용법, workflow=업무 흐름/전후관계("다음에 뭐", "전에 뭘"), troubleshoot=안 됨/오류/원인, engineer=테이블/API/로직 구조.
- queries: 검색에 유리하게 재작성한 한국어 질의 1~3개. 동의어/업무용어를 반영하되 질문의 의미를 바꾸지 마세요.
- menus: 질문에 명시된 화면/메뉴가 있으면 메뉴코드 추정값(모르면 빈 배열).
JSON 외 다른 텍스트 금지.`;

const RERANK_PROMPT = `당신은 검색 결과 리랭커입니다. 질문과 후보 문서 목록을 보고, 질문에 답하는 데 유용한 순서로 후보 번호를 JSON 배열로만 출력하세요. 관련 없는 후보는 제외하세요. 예: [3,1,5]`;

const RRF_K = 60;
const PER_QUERY_TOP_K = 12;
const RERANK_INPUT_LIMIT = 20;
const FINAL_TOP_K = 8;

@Injectable()
export class KnowledgePipelineService {
  private readonly logger = new Logger(KnowledgePipelineService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly knowledge: AiKnowledgeService,
  ) {}

  async retrieve(userMessage: string, context?: AiKnowledgeContextDto): Promise<KnowledgePipelineResult> {
    const understanding = await this.understand(userMessage);

    // [2] 멀티질의 하이브리드 검색 + RRF 융합
    const fused = await this.searchWithRrf(understanding.queries, context);

    // [3] 그래프 확장 — 관계를 점수가 아니라 컨텍스트로 포함한다
    const menuCodes = this.collectMenuCodes(fused, understanding, context);
    const audience = context?.persona === 'operator' ? 'operator' : 'user';
    const graphChunks: KnowledgeSearchResult[] = [];
    const workflowLines: string[] = [];
    const workflowIds = new Set<string>();
    for (const menuCode of menuCodes.slice(0, 3)) {
      const wfCtx = this.knowledge.getWorkflowContext(menuCode);
      for (const wf of wfCtx.workflows) {
        workflowIds.add(wf.workflowId);
        workflowLines.push(`- ${menuCode}: ${wf.title} ${wf.stepIndex}/${wf.totalSteps}단계`);
      }
      if (wfCtx.prevMenus.length > 0) workflowLines.push(`  선행 메뉴: ${wfCtx.prevMenus.join(', ')}`);
      if (wfCtx.nextMenus.length > 0) workflowLines.push(`  후행 메뉴: ${wfCtx.nextMenus.join(', ')}`);
      if (wfCtx.requires.length > 0) workflowLines.push(`  선행 조건: ${wfCtx.requires.join(', ')}`);
      const neighborMenus = [...wfCtx.prevMenus, ...wfCtx.nextMenus].filter((menu) => menu !== menuCode);
      graphChunks.push(...this.knowledge.getMenuOverviewChunks(neighborMenus, audience, 4));
    }
    if (understanding.intent === 'workflow' || understanding.intent === 'troubleshoot') {
      graphChunks.push(...this.knowledge.getWorkflowDocChunks(Array.from(workflowIds), 4));
    }
    let troubles: TroubleshootingHit[] = [];
    if (understanding.intent === 'troubleshoot') {
      troubles = this.knowledge.searchTroubleshooting(userMessage, 4);
    }

    // [4] 리랭크 — 그래프 확장 청크는 리랭크와 무관하게 유지
    const reranked = await this.rerank(userMessage, fused);
    const chunks = this.mergeUnique([...reranked.slice(0, FINAL_TOP_K), ...graphChunks]);

    // [5] 구조화 컨텍스트
    const prompt = this.buildStructuredPrompt(chunks, reranked.slice(0, FINAL_TOP_K), graphChunks, workflowLines, troubles, context);
    return { chunks, prompt, intent: understanding.intent };
  }

  /** [1] 질의 이해. 실패 시 원문 단일 질의 + usage 의도로 폴백. */
  private async understand(userMessage: string): Promise<QueryUnderstanding> {
    const fallback: QueryUnderstanding = { intent: 'usage', queries: [userMessage], menus: [] };
    try {
      const res = await this.aiService.complete([
        { role: 'system', content: UNDERSTAND_PROMPT },
        { role: 'user', content: userMessage },
      ]);
      const start = res.indexOf('{');
      const end = res.lastIndexOf('}');
      if (start === -1 || end === -1) return fallback;
      const parsed = JSON.parse(res.slice(start, end + 1)) as Partial<QueryUnderstanding>;
      const intent: KnowledgeIntent = ['usage', 'workflow', 'troubleshoot', 'engineer'].includes(parsed.intent as string)
        ? (parsed.intent as KnowledgeIntent)
        : 'usage';
      const queries = Array.isArray(parsed.queries)
        ? parsed.queries.map((q) => String(q).trim()).filter(Boolean).slice(0, 3)
        : [];
      const menus = Array.isArray(parsed.menus) ? parsed.menus.map((m) => String(m).trim()).filter(Boolean) : [];
      return { intent, queries: queries.length > 0 ? queries : [userMessage], menus };
    } catch (error: unknown) {
      this.logger.warn(`질의 이해 실패, 원문 폴백: ${error instanceof Error ? error.message : String(error)}`);
      return fallback;
    }
  }

  /** [2] 질의별 검색 결과를 RRF(1/(k+rank))로 융합한다. 단일 질의 내부 점수 체계는 knowledge.search가 담당. */
  private async searchWithRrf(queries: string[], context?: AiKnowledgeContextDto): Promise<KnowledgeSearchResult[]> {
    const rrf = new Map<string, { chunk: KnowledgeSearchResult; score: number }>();
    for (const query of queries) {
      let rows: KnowledgeSearchResult[] = [];
      try {
        rows = await this.knowledge.search(query, context ?? {}, PER_QUERY_TOP_K);
      } catch (error: unknown) {
        this.logger.warn(`지식 검색 실패(질의 스킵): ${error instanceof Error ? error.message : String(error)}`);
      }
      rows.forEach((row, rank) => {
        const entry = rrf.get(row.chunkId) ?? { chunk: row, score: 0 };
        entry.score += 1 / (RRF_K + rank + 1);
        rrf.set(row.chunkId, entry);
      });
    }
    return Array.from(rrf.values())
      .sort((a, b) => b.score - a.score)
      .map((entry) => ({ ...entry.chunk, score: entry.score }));
  }

  /** [4] LLM 리랭크. 실패 시 RRF 순서 그대로. */
  private async rerank(userMessage: string, candidates: KnowledgeSearchResult[]): Promise<KnowledgeSearchResult[]> {
    if (candidates.length < 2) return candidates;
    const input = candidates.slice(0, RERANK_INPUT_LIMIT);
    try {
      const list = input
        .map((c, i) => `${i + 1}. [${c.title ?? c.menuCode ?? c.docType}] ${c.heading ?? ''} — ${(c.summary ?? c.content).slice(0, 200)}`)
        .join('\n');
      const res = await this.aiService.complete([
        { role: 'system', content: RERANK_PROMPT },
        { role: 'user', content: `## 질문\n${userMessage}\n\n## 후보\n${list}` },
      ]);
      const start = res.indexOf('[');
      const end = res.lastIndexOf(']');
      if (start === -1 || end === -1) return candidates;
      const order = (JSON.parse(res.slice(start, end + 1)) as unknown[])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= input.length);
      if (order.length === 0) return candidates;
      const picked = order.map((n) => input[n - 1]);
      const rest = input.filter((c) => !picked.includes(c));
      return [...picked, ...rest, ...candidates.slice(RERANK_INPUT_LIMIT)];
    } catch (error: unknown) {
      this.logger.warn(`리랭크 실패, RRF 순서 유지: ${error instanceof Error ? error.message : String(error)}`);
      return candidates;
    }
  }

  private collectMenuCodes(
    fused: KnowledgeSearchResult[],
    understanding: QueryUnderstanding,
    context?: AiKnowledgeContextDto,
  ): string[] {
    const menus = new Set<string>();
    if (context?.menuCode) menus.add(context.menuCode);
    for (const menu of understanding.menus) menus.add(menu);
    for (const chunk of fused.slice(0, 5)) if (chunk.menuCode) menus.add(chunk.menuCode);
    return Array.from(menus);
  }

  private mergeUnique(chunks: KnowledgeSearchResult[]): KnowledgeSearchResult[] {
    const seen = new Set<string>();
    const out: KnowledgeSearchResult[] = [];
    for (const chunk of chunks) {
      if (seen.has(chunk.chunkId)) continue;
      seen.add(chunk.chunkId);
      out.push(chunk);
    }
    return out;
  }

  /** [5] 답변 LLM이 관계를 명시적으로 인지하도록 섹션을 구분해 컨텍스트를 구성한다. */
  private buildStructuredPrompt(
    all: KnowledgeSearchResult[],
    primary: KnowledgeSearchResult[],
    graphChunks: KnowledgeSearchResult[],
    workflowLines: string[],
    troubles: TroubleshootingHit[],
    context?: AiKnowledgeContextDto,
  ): string {
    if (all.length === 0) return '';
    const graphIds = new Set(graphChunks.map((c) => c.chunkId));
    const currentMenu = context?.menuCode;
    const sections: string[] = [];

    const current = primary.filter((c) => !graphIds.has(c.chunkId) && (!currentMenu || c.menuCode === currentMenu || !c.menuCode));
    const related = primary.filter((c) => !graphIds.has(c.chunkId) && currentMenu && c.menuCode && c.menuCode !== currentMenu);
    if (current.length > 0) sections.push(`## 현재 화면/주제 문서\n${this.knowledge.formatContext(current)}`);
    if (workflowLines.length > 0 || graphChunks.length > 0) {
      const parts = [
        workflowLines.length > 0 ? `### 워크플로우 위치\n${workflowLines.join('\n')}` : '',
        graphChunks.length > 0 ? this.knowledge.formatContext(graphChunks) : '',
      ].filter(Boolean);
      sections.push(`## 워크플로우 전후 단계\n${parts.join('\n\n')}`);
    }
    if (troubles.length > 0) {
      const lines = troubles.map(
        (t) => `- 증상: ${t.symptom}\n  원인 후보: ${t.causes.join(' / ') || '-'}\n  조치: ${t.resolutions.join(' / ') || '-'}`,
      );
      sections.push(`## 문제 해결\n${lines.join('\n')}`);
    }
    if (related.length > 0) sections.push(`## 관련 화면 문서\n${this.knowledge.formatContext(related)}`);
    return sections.join('\n\n');
  }
}
```

- [ ] **Step 4: ai.module.ts에 provider 등록**

`apps/backend/src/modules/ai/ai.module.ts`의 `providers` 배열에 `KnowledgePipelineService` 추가하고 import 문 추가:

```ts
import { KnowledgePipelineService } from './knowledge-pipeline.service';
```

(providers 배열에 `KnowledgePipelineService,` 추가. 기존 배열 구조 유지.)

- [ ] **Step 5: 테스트/타입 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai/knowledge-pipeline.service.spec.ts
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: 5 PASS, 타입 0 errors.

- [ ] **Step 6: 커밋**

```bash
git add apps/backend/src/modules/ai/knowledge-pipeline.service.ts apps/backend/src/modules/ai/knowledge-pipeline.service.spec.ts apps/backend/src/modules/ai/ai.module.ts
git commit -m "feat(ai): 지식 검색 풀 파이프라인 (질의이해→RRF→그래프확장→리랭크)"
```

---

### Task 5: ai-sql.service 통합

**Files:**
- Modify: `apps/backend/src/modules/ai/ai-sql.service.ts`
- Test: `apps/backend/src/modules/ai/ai-sql.service.spec.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 4의 `KnowledgePipelineService.retrieve`
- Produces: 기존 `AiSqlResult` 계약 불변 (sources 채워짐). 답변 프롬프트에 intent별 지침 추가.

- [ ] **Step 1: 실패하는 테스트 추가**

기존 `apps/backend/src/modules/ai/ai-sql.service.spec.ts`를 먼저 읽고, 그 스타일에 맞춰 아래 테스트를 추가한다 (생성자 시그니처가 바뀌므로 기존 테스트의 인스턴스 생성부도 `knowledgePipeline` mock을 추가해야 한다):

```ts
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
```

주의: 기존 spec의 `new AiSqlService(...)` 호출들이 있으면 생성자 7번째 인자(knowledgePipeline mock `{ retrieve: jest.fn().mockResolvedValue({ intent: 'usage', prompt: '', chunks: [] }) }`)를 끼워 넣어 컴파일을 맞춘다.

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai/ai-sql.service.spec.ts
```

Expected: 신규 2개 FAIL (생성자 인자 불일치 또는 retrieve 미호출).

- [ ] **Step 3: 구현**

`ai-sql.service.ts` 수정:

(a) import 추가:

```ts
import { KnowledgeIntent, KnowledgePipelineService } from './knowledge-pipeline.service';
```

(b) 생성자에 주입 추가 — `private readonly knowledge: AiKnowledgeService,` 다음 줄:

```ts
    private readonly knowledgePipeline: KnowledgePipelineService,
```

(c) `process()`의 지식 검색 블록(try/catch)을 다음으로 교체:

```ts
    let knowledgePrompt = '';
    let knowledgeChunks: KnowledgeSearchResult[] = [];
    let knowledgeIntent: KnowledgeIntent = 'usage';
    try {
      const pipelineResult = await this.knowledgePipeline.retrieve(userMessage, knowledgeContext);
      knowledgePrompt = pipelineResult.prompt;
      knowledgeChunks = pipelineResult.chunks;
      knowledgeIntent = pipelineResult.intent;
    } catch (error: unknown) {
      this.logger.warn(`지식 파이프라인 실패, 단일 검색 폴백: ${error instanceof Error ? error.message : String(error)}`);
      try {
        knowledgeChunks = await this.knowledge.search(userMessage, knowledgeContext, 5);
        knowledgePrompt = this.knowledge.formatContext(knowledgeChunks);
      } catch (fallbackError: unknown) {
        this.logger.warn(`AI 지식 검색 실패: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`);
      }
    }

    const result = await this.processWithKnowledge(userMessage, messages, pageToolContext, knowledgePrompt, knowledgeContext, knowledgeIntent);
    return this.withSources(result, knowledgeChunks);
```

(d) `processWithKnowledge` / `generalChat` / `analyze` 시그니처에 `knowledgeIntent: KnowledgeIntent = 'usage'` 파라미터를 끝에 추가하고, 내부 호출부(this.generalChat(...) 4곳, this.analyze(...) 1곳)에 전달한다.

(e) intent별 답변 지침 헬퍼 추가 + generalChat/analyze system 프롬프트에 포함:

```ts
  private formatIntentPrompt(intent: KnowledgeIntent): string {
    switch (intent) {
      case 'workflow':
        return '이 질문은 업무 흐름(전후관계) 질문입니다. "워크플로우 전후 단계" 섹션을 근거로 선행 단계 → 현재 단계 → 후행 단계 순서로 답하고, 각 단계의 메뉴 이름을 명시하세요.';
      case 'troubleshoot':
        return '이 질문은 문제 해결 질문입니다. "문제 해결" 섹션과 문서 근거로 증상 → 원인 후보 → 확인/조치 순서로 답하세요. 선행 조건 미충족 가능성을 우선 확인하세요.';
      case 'engineer':
        return '이 질문은 기술 구조 질문입니다. 비즈니스 로직 문서를 근거로 테이블/API/상태 전이를 중심으로 답하세요.';
      default:
        return '';
    }
  }
```

`generalChat`의 `systemParts` 조립을 다음으로 교체:

```ts
    const systemParts = [GENERAL_PROMPT, personaPrompt, this.formatIntentPrompt(knowledgeIntent), pageToolPrompt, knowledgeSystem]
      .filter(Boolean)
      .join('\n\n');
```

`analyze`의 system 메시지도 같은 방식으로 `this.formatIntentPrompt(knowledgeIntent)`를 `formatPersonaPrompt` 뒤에 추가한다.

- [ ] **Step 4: 테스트/타입 확인**

```bash
pnpm.cmd --filter @harness/backend exec jest --runTestsByPath src/modules/ai/ai-sql.service.spec.ts
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: 전부 PASS, 타입 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add apps/backend/src/modules/ai/ai-sql.service.ts apps/backend/src/modules/ai/ai-sql.service.spec.ts
git commit -m "feat(ai): 채팅이 지식 풀 파이프라인 사용 (폴백 포함)"
```

---

### Task 6: 워크플로우 문서 초안 5개 생성 (사용자 검수 게이트)

**Files:**
- Create: `docs/workflows/definitions/production-flow.md`
- Create: `docs/workflows/definitions/material-flow.md`
- Create: `docs/workflows/definitions/quality-flow.md`
- Create: `docs/workflows/definitions/shipping-flow.md`
- Create: `docs/workflows/definitions/label-serial-flow.md`

**절차 (코드 아님 — 콘텐츠 작업):**

- [ ] **Step 1: 소스 수집** — `apps/frontend/src/config/menuConfig*`에서 메뉴코드 체계 확인, `docs/business-logics/*.md`와 `apps/frontend/public/help/user/ko/*.md`에서 각 영역의 상태 전이/선행 조건을 확인한다. 메뉴코드는 반드시 도움말 frontmatter의 실제 `menuCode` 값을 사용한다(추측 금지 — Task 2의 reindex 경고가 오타를 잡지만 처음부터 실측).
- [ ] **Step 2: 초안 작성** — 스펙 4-A 스키마(workflowId/title/steps[menu,requires,transitions,produces]/troubleshooting/relatedWorkflows)로 5개 영역 초안 작성. 각 문서 본문에는 단계별 설명(왜 이 순서인지, 상태 전이 의미)을 포함한다.
- [ ] **Step 3: 파서 검증** — 임시 스크립트가 아니라 reindex 호출로 검증한다: 백엔드 dev 서버가 떠 있으면 `POST /api/v1/ai/knowledge/reindex` (targets: ["docs/workflows/definitions"]) 후 응답의 `workflowErrors`/`workflowWarnings`가 비어 있는지 확인. 서버가 없으면 jest 임시 테스트로 5개 파일 각각 `parseWorkflowDoc` errors=[] 확인.
- [ ] **Step 4: 사용자 검수 요청** — 5개 초안을 사용자에게 보여주고 업무 흐름이 실제와 맞는지 확인받는다. **검수 승인 전에는 커밋하지 않는다.**
- [ ] **Step 5: 검수 반영 후 커밋**

```bash
git add docs/workflows/definitions/production-flow.md docs/workflows/definitions/material-flow.md docs/workflows/definitions/quality-flow.md docs/workflows/definitions/shipping-flow.md docs/workflows/definitions/label-serial-flow.md
git commit -m "docs(workflows): 핵심 업무 흐름 워크플로우 정의 5종 (검수 완료)"
```

---

### Task 7: local-hash 경고 배지 (프론트)

**Files:**
- Modify: `apps/frontend/src/components/ai/AiChatPanel.tsx`
- Modify: `apps/frontend/src/locales/ko/translation.json`, `en/translation.json`, `zh/translation.json`, `vi/translation.json`

**Interfaces:**
- Consumes: `GET /ai/knowledge/status` 응답의 `realEmbeddingProvider: boolean`

- [ ] **Step 1: 상태 추가** — `AiChatPanel.tsx`의 `aiStatus` state 아래에 추가:

```tsx
  const [embeddingDegraded, setEmbeddingDegraded] = useState(false);
```

- [ ] **Step 2: 조회 추가** — 기존 `/ai/status` useEffect(104행 부근) 내부에 knowledge status 조회를 병렬 추가:

```tsx
    api
      .get("/ai/knowledge/status")
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data ?? res.data ?? {};
        setEmbeddingDegraded(data.realEmbeddingProvider === false);
      })
      .catch(() => {
        /* 배지는 부가 정보 — 실패해도 채팅 흐름을 막지 않는다 */
      });
```

- [ ] **Step 3: 배지 렌더** — 헤더의 aiStatus 배지(319행 부근 `{aiStatus && (...)}`) 바로 아래에 추가:

```tsx
          {embeddingDegraded && (
            <span
              className="rounded-full border border-amber-500 px-2 py-0.5 text-[11px] font-normal text-amber-600"
              title={t("ai.chat.embeddingDegradedHint", "임베딩 API 키가 없어 의미 검색이 비활성화되었습니다. 시스템 설정에서 AI 임베딩 키를 등록하세요.")}
            >
              {t("ai.chat.embeddingDegraded", "의미 검색 비활성")}
            </span>
          )}
```

(파스텔 배경 금지 규칙 준수 — 텍스트/테두리 색만 사용.)

- [ ] **Step 4: i18n 4개 언어 추가** — 각 `translation.json`의 `ai.chat` 객체에 키 2개 추가 (BOM 없이, 기존 들여쓰기 유지):

- ko: `"embeddingDegraded": "의미 검색 비활성"`, `"embeddingDegradedHint": "임베딩 API 키가 없어 의미 검색이 비활성화되었습니다. 시스템 설정에서 AI 임베딩 키를 등록하세요."`
- en: `"embeddingDegraded": "Semantic search off"`, `"embeddingDegradedHint": "Semantic search is disabled because no embedding API key is set. Register an AI embedding key in System Config."`
- zh: `"embeddingDegraded": "语义搜索未启用"`, `"embeddingDegradedHint": "未配置嵌入 API 密钥，语义搜索已停用。请在系统设置中注册 AI 嵌入密钥。"`
- vi: `"embeddingDegraded": "Tắt tìm kiếm ngữ nghĩa"`, `"embeddingDegradedHint": "Tìm kiếm ngữ nghĩa bị tắt vì chưa có khóa API embedding. Hãy đăng ký khóa AI embedding trong Cấu hình hệ thống."`

검증:

```bash
grep -l "embeddingDegraded" apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json
```

Expected: 4개 파일 모두 출력.

- [ ] **Step 5: 타입 확인**

```bash
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: 0 errors.

- [ ] **Step 6: 커밋**

```bash
git add apps/frontend/src/components/ai/AiChatPanel.tsx apps/frontend/src/locales/ko/translation.json apps/frontend/src/locales/en/translation.json apps/frontend/src/locales/zh/translation.json apps/frontend/src/locales/vi/translation.json
git commit -m "feat(ai-chat): 임베딩 degrade 경고 배지 표시"
```

주의: `AiChatPanel.tsx`에는 미커밋 변경이 이미 있으므로 이 커밋에 섞여 들어간다. 커밋 전 `git diff --cached apps/frontend/src/components/ai/AiChatPanel.tsx`로 내용을 확인하고, 기존 미커밋 변경이 의도한 상태인지 사용자에게 한 번 확인한다.

---

### Task 8: 도움말 frontmatter 점검 스크립트

**Files:**
- Create: `tools/help-frontmatter-audit.mjs`

- [ ] **Step 1: 스크립트 작성**

```js
#!/usr/bin/env node
/**
 * @file tools/help-frontmatter-audit.mjs
 * @description 도움말 md frontmatter 필수 필드(menuCode/summary/keywords) 누락 점검.
 * 사용: node tools/help-frontmatter-audit.mjs [--json]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['apps/frontend/public/help/user/ko', 'apps/frontend/public/help/operator/ko'];

function listMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listMd(full);
    return entry.isFile() && entry.name.endsWith('.md') ? [full] : [];
  });
}

function parseFrontMatter(raw) {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) return null;
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z][\w]*)\s*:\s*(.*)$/.exec(line.trim());
    if (m) meta[m[1]] = m[2].trim();
  }
  return meta;
}

const results = [];
for (const root of ROOTS) {
  for (const file of listMd(root)) {
    const raw = fs.readFileSync(file, 'utf8');
    const meta = parseFrontMatter(raw);
    const missing = [];
    if (!meta) missing.push('frontmatter 없음');
    else {
      if (!meta.menuCode) missing.push('menuCode');
      if (!meta.summary) missing.push('summary');
      if (!meta.keywords) missing.push('keywords');
    }
    if (raw.charCodeAt(0) === 0xfeff) missing.push('UTF-8 BOM 존재');
    if (missing.length > 0) results.push({ file: file.replace(/\\/g, '/'), missing });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  if (results.length === 0) console.log('누락 없음 — 모든 도움말 frontmatter가 완전합니다.');
  for (const { file, missing } of results) console.log(`${file}: ${missing.join(', ')}`);
  console.log(`\n총 ${results.length}개 파일에 누락 항목이 있습니다.`);
}
process.exitCode = results.length > 0 ? 1 : 0;
```

- [ ] **Step 2: 실행 및 결과 보고**

```bash
node tools/help-frontmatter-audit.mjs
```

Expected: 누락 파일 목록 출력. 결과를 사용자에게 보고하고 보완 규모를 공유한다. (일괄 보완은 별도 후속 작업 — 이 계획 범위는 점검까지.)

- [ ] **Step 3: 커밋**

```bash
git add tools/help-frontmatter-audit.mjs
git commit -m "chore(tools): 도움말 frontmatter 누락 점검 스크립트"
```

---

### Task 9: 재인덱싱 + golden 질문 평가

**Files:**
- Create: `docs/reports/ai-rag-golden-questions.md`

- [ ] **Step 1: golden 질문 목록 작성** — 4개 유형 × 3개씩 12문항. 각 문항에 기대 근거(어느 문서/워크플로우가 인용되어야 하는지)를 명시:

```md
# AI RAG golden 질문 평가 세트

각 질문을 채팅 패널(해당 페르소나)에서 실행하고, 답변이 기대 근거를 인용하며 단편적이지 않은지 O/X 기록한다.

## 화면 사용법 (persona: user)
1. 박스입고는 어떻게 해? — 기대: FG_RECEIVE 사용자 도움말
2. 작업지시는 어디서 등록해? — 기대: JOB_ORDER 도움말
3. 불량 등록 방법 알려줘 — 기대: 불량관리 도움말

## 워크플로우 전후관계 (persona: user)
4. 작업지시 내리고 나면 다음에 뭐 해야 돼? — 기대: production-flow의 후행 단계(투입) 안내
5. 박스입고 하기 전에 뭘 먼저 해야 해? — 기대: 선행 조건(FG_LABEL 발행) 안내
6. 생산계획부터 입고까지 전체 순서를 알려줘 — 기대: production-flow 단계 순서 전체

## 문제 해결 (persona: operator)
7. 라벨 발행이 안 되는데 왜? — 기대: troubleshooting 증상 매칭(작업지시 상태 등)
8. 입고가 안 돼요 — 기대: 선행 조건 미충족 후보 제시
9. 실적 취소는 어떻게 하고 재고는 어떻게 돼? — 기대: 운영자 도움말 + 영향 설명

## 엔지니어 (persona: engineer)
10. 박스입고 저장하면 어떤 테이블이 바뀌어? — 기대: business-logics 문서
11. 작업지시 상태 전이 규칙 알려줘 — 기대: WAITING/RUNNING/... 상태 전이
12. 생산실적 삭제 시 역분개 로직 설명해줘 — 기대: business-logics PROD_RESULT

## 결과 기록
| # | 개선 전 | 개선 후 | 비고 |
|---|---------|---------|------|
```

- [ ] **Step 2: 재인덱싱 실행** — dev 백엔드가 떠 있는 상태에서:

```bash
curl -s -X POST http://localhost:3001/api/v1/ai/knowledge/reindex -H "Content-Type: application/json" -d "{}"
```

(백엔드 포트는 실제 dev 환경 값 확인. 프론트 3002 기준 백엔드 포트를 `apps/backend` 설정에서 확인해 사용.)
Expected: 응답에 `workflowErrors: []`, `graphEdges > 0`, chunks 수 증가.

- [ ] **Step 3: 12문항 실측** — 채팅 패널에서 각 질문 실행, 결과 표 기록. 워크플로우/문제해결 유형에서 전후 단계·원인 후보가 답변에 포함되는지 확인. 실패 문항은 원인(검색 누락/그래프 누락/프롬프트)을 메모.

- [ ] **Step 4: 결과 보고 + 커밋**

```bash
git add docs/reports/ai-rag-golden-questions.md
git commit -m "docs(reports): AI RAG golden 질문 평가 세트 및 결과"
```

- [ ] **Step 5: coordination 마무리** — TASKS.md에서 T-AI-RAG-V2를 REVIEW_QUEUE.md로 이동, LOCKS.md에서 lock 제거, HANDOFF/claude.md 갱신. 별도 커밋:

```bash
git add .ai-coordination/TASKS.md .ai-coordination/LOCKS.md .ai-coordination/REVIEW_QUEUE.md .ai-coordination/HANDOFF/claude.md
git commit -m "chore(coordination): T-AI-RAG-V2 구현 완료, 리뷰 대기로 이동"
```

---

## 실행 순서와 의존성

```
Task 0 (coordination)
 → Task 1 (파서) → Task 2 (그래프) → Task 3 (맥락 청킹)
 → Task 4 (파이프라인) → Task 5 (ai-sql 통합)
 → Task 6 (워크플로우 문서, 사용자 검수 게이트) — Task 2 이후면 언제든 병행 가능
 → Task 7 (FE 배지) — 독립, 언제든 가능
 → Task 8 (frontmatter 점검) — 독립, 언제든 가능
 → Task 9 (재인덱싱+평가) — Task 5·6 완료 후
```
