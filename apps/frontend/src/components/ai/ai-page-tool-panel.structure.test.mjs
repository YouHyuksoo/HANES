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

test('AI chat panel has chat tools and log tabs', () => {
  const source = read('apps/frontend/src/components/ai/AiChatPanel.tsx');
  assert.match(source, /PageToolInspector/);
  assert.match(source, /PageToolExecutionLog/);
  assert.match(source, /activeTab/);
  assert.match(source, /openToolsTab/);
});

test('AI chat panel lets users choose a persona for questions', () => {
  const source = read('apps/frontend/src/components/ai/AiChatPanel.tsx');
  assert.match(source, /AI_PERSONAS/);
  assert.match(source, /setPersona/);
  assert.match(source, /일반사용자/);
  assert.match(source, /운영관리자/);
  assert.match(source, /시스템엔지니어/);
  assert.match(source, /persona/);
});

test('AI persona selector explains answer style on hover', () => {
  const source = read('apps/frontend/src/components/ai/AiChatPanel.tsx');
  assert.match(source, /description/);
  assert.match(source, /group-hover:opacity-100/);
  assert.match(source, /group-focus-within:opacity-100/);
  assert.match(source, /사용자 도움말/);
  assert.match(source, /운영 절차/);
  assert.match(source, /API/);
});

test('AI chat panel exposes explicit route mode prefix buttons', () => {
  const source = read('apps/frontend/src/components/ai/AiChatPanel.tsx');
  assert.match(source, /AI_ROUTE_MODES/);
  assert.match(source, /applyRoutePrefix/);
  assert.match(source, /\/MES/);
  assert.match(source, /\/HELP/);
  assert.match(source, /\/DO/);
  assert.match(source, /\/WEB/);
});

test('AI chat panel supports voice input, speech output, and image attachments', () => {
  const source = read('apps/frontend/src/components/ai/AiChatPanel.tsx');
  const store = read('apps/frontend/src/stores/aiChatStore.ts');
  assert.match(source, /SpeechRecognition/);
  assert.match(source, /speechSynthesis/);
  assert.match(source, /ImagePlus/);
  assert.match(source, /accept="image\/\*"/);
  assert.match(source, /attachments/);
  assert.match(store, /AiChatAttachment/);
  assert.match(store, /attachments\?: AiChatAttachment\[\]/);
});

test('AI chat panel opens at double width and accepts pasted screenshots', () => {
  const source = read('apps/frontend/src/components/ai/AiChatPanel.tsx');
  assert.match(source, /DEFAULT_AI_CHAT_WIDTH\s*=\s*880/);
  assert.match(source, /useState\(DEFAULT_AI_CHAT_WIDTH\)/);
  assert.match(source, /handlePaste/);
  assert.match(source, /clipboardData\.files/);
  assert.match(source, /onPaste=\{handlePaste\}/);
});

test('AI chat store persists conversation history and persona', () => {
  const source = read('apps/frontend/src/stores/aiChatStore.ts');
  assert.match(source, /persist/);
  assert.match(source, /hanes\.aiChat\.v1/);
  assert.match(source, /messages/);
  assert.match(source, /persona/);
  assert.match(source, /setPersona/);
});

test('page AI tools hook registers manifest and frontend executors', () => {
  const source = read('apps/frontend/src/ai-page-tools/usePageAiTools.ts');
  assert.match(source, /\/ai\/page-tools\/\$\{pageId\}/);
  assert.match(source, /setActivePage/);
  assert.match(source, /setFrontendExecutors/);
  assert.match(source, /executeFrontendTool/);
});
