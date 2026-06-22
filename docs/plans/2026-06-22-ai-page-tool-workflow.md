# AI Page Tool Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the common HANES AI Page Tool Workflow with `/production/order` as the first draft-only pilot.

**Architecture:** Backend owns page tool manifests and read-only candidate resolution. Frontend owns active page context, tool inspector UI, tool execution log, and draft application into page state. AI chat uses the same manifest that people see, and phase 1 never calls write APIs directly.

**Tech Stack:** NestJS, TypeORM, Oracle, Next.js App Router, React 19, Zustand, lucide-react, Node structure tests, Jest, pnpm.cmd on Windows.

---

## Global Constraints

- Do not implement AI direct save/delete/status-change tools in phase 1.
- Do not use LLM-generated SQL for business writes.
- Do not touch currently locked files owned by other agents.
- Do not commit unless the user explicitly asks. Commit examples in generic skills are superseded by HANES repo rules.
- Use `pnpm.cmd`, not `pnpm`, in PowerShell.
- Keep `/production/order` as the pilot only; the common types and workflow must be reusable by later pages.

## File Structure

Backend:

- Create `apps/backend/src/modules/ai-page-tools/ai-page-tools.module.ts`
  - Registers page tool controller and service.
- Create `apps/backend/src/modules/ai-page-tools/ai-page-tools.controller.ts`
  - `GET /ai/page-tools/:pageId`
  - `POST /ai/page-tools/:pageId/execute`
- Create `apps/backend/src/modules/ai-page-tools/ai-page-tools.service.ts`
  - Manifest lookup and backend read-only tool dispatch.
- Create `apps/backend/src/modules/ai-page-tools/types.ts`
  - Shared backend interfaces for manifest/tool result.
- Create `apps/backend/src/modules/ai-page-tools/registry/production-order.tools.ts`
  - `/production/order` manifest and backend candidate resolvers.
- Create `apps/backend/src/modules/ai-page-tools/ai-page-tools.service.spec.ts`
  - Manifest and candidate policy tests.
- Modify `apps/backend/src/app.module.ts`
  - Import `AiPageToolsModule`.

Frontend:

- Create `apps/frontend/src/ai-page-tools/types.ts`
  - Frontend manifest, execution log, draft types.
- Create `apps/frontend/src/ai-page-tools/pageToolStore.ts`
  - Zustand state for active page manifest, active tab, execution logs.
- Create `apps/frontend/src/ai-page-tools/usePageAiTools.ts`
  - Hook for pages to register page ID and frontend draft executors.
- Create `apps/frontend/src/components/ai/PageToolInspector.tsx`
  - Human-readable tool list from manifest.
- Create `apps/frontend/src/components/ai/PageToolExecutionLog.tsx`
  - Recent execution log panel.
- Modify `apps/frontend/src/components/ai/AiChatPanel.tsx`
  - Add `채팅 | 도구 | 실행로그` tabs and include page tool context in chat calls.
- Modify `apps/frontend/src/stores/aiChatStore.ts`
  - Add `open(tab?: "chat" | "tools" | "log")` and active tab state, or delegate to `pageToolStore`.
- Modify `apps/frontend/src/app/(authenticated)/production/order/page.tsx`
  - Add `도구보기` header button and page tool registration.
  - Add draft application handler that opens `JobOrderFormPanel` with AI draft values.
- Modify `apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx`
  - Accept optional draft defaults and support server-generated `orderNo` by allowing new drafts to omit `orderNo`.
- Create `apps/frontend/src/app/(authenticated)/production/order/ai-page-tools.structure.test.mjs`
  - Page button, draft-only contract, and no direct save tests.
- Create `apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs`
  - AI panel tab and inspector rendering tests.

Docs and coordination:

- Keep `docs/specs/2026-06-22-ai-page-tool-workflow-design.md`.
- This plan lives at `docs/plans/2026-06-22-ai-page-tool-workflow.md`.
- Update `.ai-coordination/TASKS.md`, `JOURNAL.md`, `HANDOFF/codex.md` after implementation.

---

### Task 1: Backend Manifest Skeleton

**Files:**
- Create: `apps/backend/src/modules/ai-page-tools/types.ts`
- Create: `apps/backend/src/modules/ai-page-tools/registry/production-order.tools.ts`
- Create: `apps/backend/src/modules/ai-page-tools/ai-page-tools.service.ts`
- Create: `apps/backend/src/modules/ai-page-tools/ai-page-tools.controller.ts`
- Create: `apps/backend/src/modules/ai-page-tools/ai-page-tools.module.ts`
- Create: `apps/backend/src/modules/ai-page-tools/ai-page-tools.service.spec.ts`
- Modify: `apps/backend/src/app.module.ts`

- [ ] **Step 1: Write failing backend manifest tests**

Create `apps/backend/src/modules/ai-page-tools/ai-page-tools.service.spec.ts` with tests asserting:

```ts
describe('AiPageToolsService', () => {
  it('returns production.order manifest as draft-only', () => {
    const service = new AiPageToolsService(/* mocked repos */);
    const manifest = service.getManifest('production.order');
    expect(manifest.pageId).toBe('production.order');
    expect(manifest.route).toBe('/production/order');
    expect(manifest.executionLevel).toBe('draft-only');
    expect(manifest.tools.map((tool) => tool.name)).toContain('resolveItemCandidates');
    expect(manifest.tools.map((tool) => tool.name)).toContain('applyJobOrderDraft');
    expect(manifest.tools.find((tool) => tool.name === 'applyJobOrderDraft')?.neverPersists).toBe(true);
  });

  it('rejects unknown page IDs', () => {
    const service = new AiPageToolsService(/* mocked repos */);
    expect(() => service.getManifest('unknown.page')).toThrow('지원하지 않는 AI 페이지 도구입니다');
  });
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/ai-page-tools/ai-page-tools.service.spec.ts --runInBand
```

Expected: FAIL because module/service files do not exist.

- [ ] **Step 3: Implement backend types and manifest**

Create `types.ts`:

```ts
export type AiPageToolRiskLevel = 'read' | 'draft' | 'propose' | 'write';
export type AiPageToolSource = 'backend' | 'frontend';

export interface AiPageToolDefinition {
  name: string;
  label: string;
  description: string;
  riskLevel: AiPageToolRiskLevel;
  source: AiPageToolSource;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  confirmationPolicy?: string;
  requiresConfirmation?: boolean;
  neverPersists?: boolean;
}

export interface AiPageToolManifest {
  pageId: string;
  route: string;
  title: string;
  executionLevel: 'draft-only' | 'approval-required' | 'write-enabled';
  tools: AiPageToolDefinition[];
}
```

Create `registry/production-order.tools.ts` exporting `PRODUCTION_ORDER_TOOL_MANIFEST` with:

- `resolveItemCandidates`
- `resolveLineCandidates`
- `resolveProcessCandidates`
- `resolveEquipmentCandidates`
- `buildJobOrderDraft`
- `applyJobOrderDraft`

Create `AiPageToolsService.getManifest(pageId)` that returns the manifest or throws `BadRequestException`.

- [ ] **Step 4: Add controller/module and app import**

Controller:

```ts
@Controller('ai/page-tools')
export class AiPageToolsController {
  constructor(private readonly service: AiPageToolsService) {}

  @Get(':pageId')
  getManifest(@Param('pageId') pageId: string) {
    return ResponseUtil.success(this.service.getManifest(pageId));
  }
}
```

Module:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([PartMaster, ProdLine, ProcessMaster, EquipMaster])],
  controllers: [AiPageToolsController],
  providers: [AiPageToolsService],
})
export class AiPageToolsModule {}
```

Import `AiPageToolsModule` in `apps/backend/src/app.module.ts` near `AiModule`.

- [ ] **Step 5: Run backend tests**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/ai-page-tools/ai-page-tools.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 2: Backend Candidate Resolution

**Files:**
- Modify: `apps/backend/src/modules/ai-page-tools/ai-page-tools.service.ts`
- Modify: `apps/backend/src/modules/ai-page-tools/ai-page-tools.controller.ts`
- Modify: `apps/backend/src/modules/ai-page-tools/ai-page-tools.service.spec.ts`

- [ ] **Step 1: Add failing tests for candidate policy**

Extend service spec:

```ts
it('marks exact itemCode single match as autoConfirmable', async () => {
  partRepo.find.mockResolvedValue([{ itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED' }]);
  const result = await service.executeBackendTool('production.order', 'resolveItemCandidates', { query: 'HNS02' }, '40', '1000');
  expect(result.status).toBe('ok');
  expect(result.candidates).toHaveLength(1);
  expect(result.confirmation.required).toBe(false);
});

it('requires confirmation for name-based single match', async () => {
  partRepo.find.mockResolvedValue([{ itemCode: 'HNS02', itemName: '메인 하네스', itemType: 'FINISHED' }]);
  const result = await service.executeBackendTool('production.order', 'resolveItemCandidates', { query: '메인 하네스' }, '40', '1000');
  expect(result.confirmation.required).toBe(true);
});

it('requires user selection for multiple item candidates', async () => {
  partRepo.find.mockResolvedValue([
    { itemCode: 'HNS02', itemName: '메인 하네스' },
    { itemCode: 'HNS02C1ABCD', itemName: '서브 하네스' },
  ]);
  const result = await service.executeBackendTool('production.order', 'resolveItemCandidates', { query: 'HNS' }, '40', '1000');
  expect(result.confirmation.required).toBe(true);
  expect(result.confirmation.reason).toBe('multiple_candidates');
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/ai-page-tools/ai-page-tools.service.spec.ts --runInBand
```

Expected: FAIL because `executeBackendTool` is not implemented.

- [ ] **Step 3: Implement backend execution DTO and endpoint**

Controller endpoint:

```ts
@Post(':pageId/execute')
async execute(
  @Param('pageId') pageId: string,
  @Body() body: { toolName: string; input: Record<string, unknown> },
  @Company() company: string,
  @Plant() plant: string,
) {
  const data = await this.service.executeBackendTool(pageId, body.toolName, body.input, company, plant);
  return ResponseUtil.success(data);
}
```

Service dispatch:

```ts
async executeBackendTool(pageId: string, toolName: string, input: Record<string, unknown>, company?: string, plant?: string) {
  const manifest = this.getManifest(pageId);
  const tool = manifest.tools.find((item) => item.name === toolName);
  if (!tool) throw new BadRequestException(`현재 페이지에서 사용할 수 없는 도구입니다: ${toolName}`);
  if (tool.source !== 'backend') throw new BadRequestException(`프론트엔드 전용 도구입니다: ${toolName}`);
  if (tool.riskLevel !== 'read') throw new BadRequestException('1차 표준에서는 read 도구만 서버에서 실행합니다.');

  if (pageId === 'production.order' && toolName === 'resolveItemCandidates') {
    return this.resolveItemCandidates(String(input.query ?? ''), company, plant);
  }
  // Implement line/process/equipment read tools similarly.
  throw new BadRequestException(`구현되지 않은 도구입니다: ${toolName}`);
}
```

Candidate result shape:

```ts
{
  status: 'ok',
  candidates: [...],
  confirmation: {
    required: boolean,
    reason: 'none' | 'not_found' | 'single_name_match' | 'multiple_candidates'
  }
}
```

- [ ] **Step 4: Run backend tests**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec jest src/modules/ai-page-tools/ai-page-tools.service.spec.ts --runInBand
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
```

Expected: PASS.

---

### Task 3: Frontend Page Tool State and Inspector

**Files:**
- Create: `apps/frontend/src/ai-page-tools/types.ts`
- Create: `apps/frontend/src/ai-page-tools/pageToolStore.ts`
- Create: `apps/frontend/src/components/ai/PageToolInspector.tsx`
- Create: `apps/frontend/src/components/ai/PageToolExecutionLog.tsx`
- Create: `apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs`

- [ ] **Step 1: Write failing frontend structure test**

Create `ai-page-tool-panel.structure.test.mjs` asserting:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('AI page tool inspector renders manifest fields people need', () => {
  const source = read('apps/frontend/src/components/ai/PageToolInspector.tsx');
  assert.match(source, /riskLevel/);
  assert.match(source, /confirmationPolicy/);
  assert.match(source, /neverPersists/);
  assert.match(source, /inputSchema/);
});

test('AI page tool store tracks active tab and execution log', () => {
  const source = read('apps/frontend/src/ai-page-tools/pageToolStore.ts');
  assert.match(source, /activeTab/);
  assert.match(source, /executionLogs/);
  assert.match(source, /openToolsTab/);
  assert.match(source, /addExecutionLog/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs
```

Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement frontend types and store**

`types.ts` mirrors backend manifest and adds execution log:

```ts
export type AiPageToolTab = 'chat' | 'tools' | 'log';

export interface AiPageToolExecutionLog {
  id: string;
  pageId: string;
  toolName: string;
  input: unknown;
  status: 'success' | 'failed' | 'blocked';
  summary: string;
  createdAt: string;
}
```

`pageToolStore.ts`:

```ts
interface PageToolState {
  activePageId: string | null;
  manifest: AiPageToolManifest | null;
  activeTab: AiPageToolTab;
  executionLogs: AiPageToolExecutionLog[];
  setActivePage: (pageId: string, manifest: AiPageToolManifest | null) => void;
  openToolsTab: () => void;
  openChatTab: () => void;
  openLogTab: () => void;
  addExecutionLog: (log: Omit<AiPageToolExecutionLog, 'id' | 'createdAt'>) => void;
}
```

- [ ] **Step 4: Implement inspector and log components**

`PageToolInspector` renders:

- page ID/title/route
- execution level
- tool label/name
- risk level
- source
- input schema
- confirmation policy
- `neverPersists`

`PageToolExecutionLog` renders latest logs, empty state, and status.

- [ ] **Step 5: Run tests**

Run:

```powershell
node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

---

### Task 4: AI Chat Panel Tabs and Tool Context

**Files:**
- Modify: `apps/frontend/src/components/ai/AiChatPanel.tsx`
- Modify: `apps/frontend/src/stores/aiChatStore.ts`
- Modify: `apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs`

- [ ] **Step 1: Extend failing tests for tabs**

Add assertions:

```js
test('AI chat panel has chat tools and log tabs', () => {
  const source = read('apps/frontend/src/components/ai/AiChatPanel.tsx');
  assert.match(source, /PageToolInspector/);
  assert.match(source, /PageToolExecutionLog/);
  assert.match(source, /activeTab/);
  assert.match(source, /openToolsTab/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Add active tab support**

Either:

- Keep tab state in `pageToolStore`, preferred because it belongs to page tooling.
- Or extend `aiChatStore.open(tab?)` and bridge to `pageToolStore`.

Preferred behavior:

- AI FAB opens panel on `chat`.
- Page header `도구보기` opens panel on `tools`.
- `실행로그` tab remains visible even with no logs.

- [ ] **Step 4: Include manifest context in `/ai/chat` payload**

When sending chat, include page tool context without enabling writes:

```ts
const payload = {
  messages: history,
  pageToolContext: manifest
    ? {
        pageId: manifest.pageId,
        executionLevel: manifest.executionLevel,
        tools: manifest.tools.map(({ name, label, description, riskLevel, source, neverPersists, confirmationPolicy }) => ({
          name, label, description, riskLevel, source, neverPersists, confirmationPolicy,
        })),
      }
    : undefined,
};
```

Backend may initially ignore `pageToolContext`; phase 1 UI still works. Later tasks can route AI tool intent through this context.

- [ ] **Step 5: Run frontend tests**

Run:

```powershell
node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

---

### Task 5: Page Registration Hook

**Files:**
- Create: `apps/frontend/src/ai-page-tools/usePageAiTools.ts`
- Modify: `apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs`

- [ ] **Step 1: Write failing test for hook contract**

Add test:

```js
test('usePageAiTools fetches backend manifest and registers frontend executors', () => {
  const source = read('apps/frontend/src/ai-page-tools/usePageAiTools.ts');
  assert.match(source, /\/ai\/page-tools\/\$\{pageId\}/);
  assert.match(source, /frontendExecutors/);
  assert.match(source, /setActivePage/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Implement hook**

Hook shape:

```ts
export function usePageAiTools(
  pageId: string,
  frontendExecutors: Record<string, (input: unknown) => Promise<unknown> | unknown>,
) {
  const setActivePage = usePageToolStore((s) => s.setActivePage);
  const setFrontendExecutors = usePageToolStore((s) => s.setFrontendExecutors);

  useEffect(() => {
    let mounted = true;
    api.get(`/ai/page-tools/${pageId}`).then((res) => {
      if (mounted) setActivePage(pageId, res.data?.data ?? null);
    });
    setFrontendExecutors(pageId, frontendExecutors);
    return () => {
      mounted = false;
      setActivePage(null, null);
      setFrontendExecutors(pageId, {});
    };
  }, [pageId, setActivePage, setFrontendExecutors]);
}
```

Store needs `frontendExecutors` and `executeFrontendTool` support.

- [ ] **Step 4: Run tests**

Run:

```powershell
node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

---

### Task 6: `/production/order` Tool Button and Draft Applier

**Files:**
- Modify: `apps/frontend/src/app/(authenticated)/production/order/page.tsx`
- Modify: `apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx`
- Create: `apps/frontend/src/app/(authenticated)/production/order/ai-page-tools.structure.test.mjs`

- [ ] **Step 1: Write failing production-order structure tests**

Create `ai-page-tools.structure.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/order/page.tsx', 'utf8');
const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/order/components/JobOrderFormPanel.tsx', 'utf8');

test('/production/order registers AI page tools', () => {
  assert.match(page, /usePageAiTools\("production\.order"/);
  assert.match(page, /applyJobOrderDraft/);
});

test('/production/order has tool view button in header before business actions', () => {
  assert.match(page, /도구보기|production\.order\.toolView/);
  assert.match(page, /openToolsTab/);
});

test('job order AI draft does not directly save job orders', () => {
  const applyMatch = page.match(/applyJobOrderDraft[\s\S]{0,1500}/)?.[0] ?? '';
  assert.doesNotMatch(applyMatch, /api\.post\("\/production\/job-orders"/);
  assert.doesNotMatch(applyMatch, /api\.put\(`\/production\/job-orders/);
});

test('new job order can omit orderNo for server numbering', () => {
  assert.match(panel, /orderNo\?:\s*string|orderNo:\s*string\s*\|?\s*undefined/);
  assert.match(panel, /payload[\s\S]*orderNo/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/production/order/ai-page-tools.structure.test.mjs"
```

Expected: FAIL.

- [ ] **Step 3: Add page header button**

In `page.tsx`, import `Wrench` and page tool store actions.

Place button in header right group before refresh:

```tsx
<Button variant="secondary" size="sm" onClick={() => { openAiChat(); openToolsTab(); }}>
  <Wrench className="w-4 h-4 mr-1" />
  {t("production.order.toolView", "도구보기")}
</Button>
```

Keep it out of the selected-row actionbar.

- [ ] **Step 4: Register page tools**

Add `usePageAiTools("production.order", { applyJobOrderDraft })`.

Draft executor:

```ts
const applyJobOrderDraft = useCallback((input: unknown) => {
  const draft = input as Partial<JobOrderFormData> & { autoCreateChildren?: boolean };
  panelAnimateRef.current = true;
  setSelectedRow(null);
  setEditingOrder(null);
  setAiDraft(draft);
  setIsPanelOpen(true);
  addExecutionLog({
    pageId: 'production.order',
    toolName: 'applyJobOrderDraft',
    input: draft,
    status: 'success',
    summary: '작업지시 초안을 등록 패널에 적용했습니다.',
  });
}, [addExecutionLog]);
```

Use a dedicated `aiDraft` state rather than overloading `editingOrder`, because `editingOrder` means update mode.

- [ ] **Step 5: Make `JobOrderFormPanel` accept draft defaults**

Props:

```ts
interface Props {
  editingOrder: JobOrderFormData | null;
  draftOrder?: Partial<JobOrderFormData> & { autoCreateChildren?: boolean };
  onClose: () => void;
  onSave: () => void;
  animate?: boolean;
}
```

When `editingOrder` is null:

```ts
setForm({
  ...INIT_FORM,
  ...draftOrder,
  orderNo: draftOrder?.orderNo ?? '',
  planQty: draftOrder?.planQty ? String(draftOrder.planQty) : '',
  priority: String(draftOrder?.priority ?? '5'),
  autoCreateChildren: draftOrder?.autoCreateChildren ?? true,
});
```

Payload should only include `orderNo` when non-empty:

```ts
const payload = {
  ...(form.orderNo.trim() ? { orderNo: form.orderNo.trim() } : {}),
  itemCode: form.itemCode,
  ...
};
```

Do not change edit behavior.

- [ ] **Step 6: Run production-order tests**

Run:

```powershell
node --test "apps/frontend/src/app/(authenticated)/production/order/ai-page-tools.structure.test.mjs"
node --test "apps/frontend/src/app/(authenticated)/production/order/production-order-edit-sync.structure.test.mjs"
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

---

### Task 7: AI Chat DTO Compatibility

**Files:**
- Modify: `apps/backend/src/modules/ai/dto/ai-chat.dto.ts`
- Modify: `apps/backend/src/modules/ai/ai-sql.service.ts`
- Modify: `apps/backend/src/modules/ai/ai.controller.ts` if needed

- [ ] **Step 1: Add pageToolContext DTO fields**

Add optional DTO support:

```ts
export class AiPageToolContextDto {
  @IsString()
  pageId: string;

  @IsOptional()
  tools?: unknown[];

  @IsOptional()
  @IsString()
  executionLevel?: string;
}

export class AiChatDto {
  ...
  @IsOptional()
  @ValidateNested()
  @Type(() => AiPageToolContextDto)
  pageToolContext?: AiPageToolContextDto;
}
```

- [ ] **Step 2: Thread context through process without changing SQL behavior**

Change `AiSqlService.process(messages)` to accept optional context:

```ts
async process(messages: AiChatMessageDto[], pageToolContext?: AiPageToolContextDto): Promise<AiSqlResult>
```

Initial behavior can ignore context except for future prompt enrichment. Do not let page tool context enable writes.

Controller:

```ts
return this.aiSqlService.process(dto.messages, dto.pageToolContext);
```

- [ ] **Step 3: Run backend validation**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
pnpm.cmd --filter @harness/backend exec jest src/modules/ai-page-tools/ai-page-tools.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 8: End-to-End Verification

**Files:**
- Existing files from Tasks 1-7
- Update: `.ai-coordination/TASKS.md`
- Update: `.ai-coordination/JOURNAL.md`
- Update: `.ai-coordination/HANDOFF/codex.md`

- [ ] **Step 1: Run focused structure tests**

Run:

```powershell
node --test apps/frontend/src/components/ai/ai-page-tool-panel.structure.test.mjs
node --test "apps/frontend/src/app/(authenticated)/production/order/ai-page-tools.structure.test.mjs"
node --test "apps/frontend/src/app/(authenticated)/production/order/production-order-edit-sync.structure.test.mjs"
```

Expected: PASS.

- [ ] **Step 2: Run typechecks**

Run:

```powershell
pnpm.cmd --filter @harness/backend exec tsc --noEmit --pretty false
pnpm.cmd --filter @harness/frontend exec tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 3: Verify backend manifest endpoint**

With backend running:

```powershell
Invoke-WebRequest http://localhost:3003/api/ai/page-tools/production.order
```

Expected:

- HTTP 200 if authenticated bypass is not required in local setup, or auth gate behavior consistent with existing backend.
- Response data contains `pageId: "production.order"` and `executionLevel: "draft-only"`.

- [ ] **Step 4: Verify frontend page loads**

With frontend running:

```powershell
Invoke-WebRequest http://localhost:3002/production/order -UseBasicParsing
```

Expected: HTTP 200.

- [ ] **Step 5: Browser verification**

Use Playwright or the available browser tool:

- Open `http://localhost:3002/production/order`.
- Confirm header button order: `도구보기`, `새로고침`, `트리뷰/목록`, `작업지시 생성`.
- Click `도구보기`.
- Confirm AI panel opens on `도구` tab.
- Confirm manifest lists `resolveItemCandidates` and `applyJobOrderDraft`.
- Confirm `applyJobOrderDraft` is marked `draft`/`저장 안 함`.
- If test harness can call frontend executor, apply a draft and confirm the right panel opens with fields filled and no `POST /production/job-orders` request occurs.

- [ ] **Step 6: Diff check**

Run:

```powershell
git diff --check -- apps/backend/src/modules/ai-page-tools apps/backend/src/app.module.ts apps/backend/src/modules/ai apps/frontend/src/ai-page-tools apps/frontend/src/components/ai "apps/frontend/src/app/(authenticated)/production/order" docs/plans/2026-06-22-ai-page-tool-workflow.md .ai-coordination/TASKS.md .ai-coordination/JOURNAL.md .ai-coordination/HANDOFF/codex.md
```

Expected: no output.

- [ ] **Step 7: Coordination update**

Update `T-AI-PAGE-TOOL-WORKFLOW` in `.ai-coordination/TASKS.md` to `REVIEW` with verification results. Append concise evidence to `JOURNAL.md` and update `HANDOFF/codex.md`.

Do not commit unless the user explicitly asks.

---

## Execution Options After Plan

This plan is intentionally split so backend manifest/candidate resolution, frontend inspector/tabs, and `/production/order` draft application can be implemented in sequence with review checkpoints.

Recommended execution is inline in this session unless the user explicitly asks for subagents. The available subagent tool policy only allows spawning when the user explicitly requests delegation.
