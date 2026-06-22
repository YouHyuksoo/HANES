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

test('page AI tools hook registers manifest and frontend executors', () => {
  const source = read('apps/frontend/src/ai-page-tools/usePageAiTools.ts');
  assert.match(source, /\/ai\/page-tools\/\$\{pageId\}/);
  assert.match(source, /setActivePage/);
  assert.match(source, /setFrontendExecutors/);
  assert.match(source, /executeFrontendTool/);
});
