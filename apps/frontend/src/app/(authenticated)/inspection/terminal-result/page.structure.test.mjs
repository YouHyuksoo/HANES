import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

test('terminal inspection page is registered in the left menu', () => {
  const menu = read('apps/frontend/src/config/menuConfig.ts');
  assert.match(menu, /INSP_TERMINAL_RESULT/);
  assert.match(menu, /menu\.inspection\.terminalResult/);
  assert.match(menu, /\/inspection\/terminal-result/);
});

test('terminal inspection page reuses the result workflow with TERMINAL inspect type', () => {
  const pagePath = 'apps/frontend/src/app/(authenticated)/inspection/terminal-result/page.tsx';
  assert.equal(existsSync(join(root, pagePath)), true);

  const page = read(pagePath);
  assert.match(page, /TERMINAL/);
  assert.match(page, /terminalResult/);
  assert.match(page, /InspectionResultWorkflow/);

  const workflow = read('apps/frontend/src/app/(authenticated)/inspection/result/components/InspectionResultWorkflow.tsx');
  assert.match(workflow, /InspectPanel/);
  assert.match(workflow, /inspectType=\{inspectType\}/);
});

test('shared inspect panel posts the configured inspect type', () => {
  const panel = read('apps/frontend/src/app/(authenticated)/inspection/result/components/InspectPanel.tsx');
  assert.match(panel, /inspectType/);
  assert.match(panel, /api\.post\("\/quality\/continuity-inspect\/inspect", payload\)/);
  assert.match(panel, /passYn:\s*"Y",\s*inspectType/);
  assert.match(panel, /passYn:\s*"N",\s*inspectType/);
});
