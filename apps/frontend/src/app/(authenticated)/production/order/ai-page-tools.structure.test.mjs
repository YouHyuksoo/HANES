import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const panelSource = readFileSync(new URL('./components/JobOrderFormPanel.tsx', import.meta.url), 'utf8');

test('production order page exposes page tools through a header button', () => {
  assert.match(pageSource, /usePageAiTools\("production\.order"/);
  assert.match(pageSource, /openToolsTab/);
  assert.match(pageSource, /openAiChat/);
  assert.match(pageSource, /도구보기/);
});

test('production order page applies AI draft without saving it', () => {
  assert.match(pageSource, /applyJobOrderDraft/);
  assert.match(pageSource, /setAiDraft/);
  assert.match(pageSource, /setIsPanelOpen\(true\)/);
  assert.match(pageSource, /addExecutionLog/);
  const applyDraftBody = pageSource.match(/const applyJobOrderDraft = useCallback\(\(input: unknown\) => \{[\s\S]*?\}, \[addExecutionLog\]\);/)?.[0] ?? '';
  assert.ok(applyDraftBody);
  assert.doesNotMatch(applyDraftBody, /api\.(post|put|patch|delete)/);
});

test('production order form accepts draft order and leaves order number optional', () => {
  assert.match(panelSource, /draftOrder\?:/);
  assert.match(panelSource, /orderNo\?:\s*string/);
  assert.match(panelSource, /draftOrder\?\.itemCode/);
  assert.match(panelSource, /\.\.\.\(form\.orderNo\.trim\(\)\s*\?\s*\{\s*orderNo:/);
});
