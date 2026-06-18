import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');

test('production specification setup page wires the core API actions', () => {
  const page = read('apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx');

  assert.match(page, /\/production\/specifications/);
  assert.match(page, /api\.get\(`\/production\/specifications\/revisions\/\$\{revisionSummary\.revisionId\}`\)/);
  assert.match(page, /\/production\/specifications\/revisions\/\$\{selectedRevisionId\}/);
  assert.match(page, /\/production\/specifications\/revisions\/\$\{selectedRevisionId\}\/approve/);
  assert.match(page, /\/production\/specifications\/revisions\/\$\{selectedRevisionId\}\/revise/);
  assert.match(page, /circuitNo/);
  assert.match(page, /stripA/);
  assert.match(page, /endAHousing/);
  assert.match(page, /endBTerminal/);
});

test('production specification setup is registered in menu and page registry', () => {
  const menu = read('apps/frontend/src/config/menuConfig.ts');
  const registry = read('apps/frontend/src/components/layout/pageRegistry.generated.ts');
  const validator = read('apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts');

  assert.match(menu, /PROD_SPEC_SETUP/);
  assert.match(menu, /menu\.production\.specificationSetup/);
  assert.match(menu, /\/production\/specification-setup/);
  assert.match(registry, /\/production\/specification-setup/);
  assert.match(validator, /PROD_SPEC_SETUP/);
});

test('production specification setup has Korean menu and page labels', () => {
  const ko = read('apps/frontend/src/locales/ko.json');
  assert.match(ko, /"specificationSetup"\s*:\s*"제품 도면관리"/);
  assert.match(ko, /"specificationSetupDescription"\s*:\s*"제품별 하네스 도면 Revision과 회로별 제작 사양을 관리합니다\."/);
});

test('production specification setup renders connection symbols as drawings', () => {
  const page = read('apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx');

  assert.match(page, /function ConnectionSymbolControl/);
  assert.match(page, /data-connection-symbol=/);
  assert.match(page, /<svg/);
  assert.match(page, /connectionSymbolOptions/);
});

test('production specification setup only sends DTO fields when saving circuits', () => {
  const page = read('apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx');

  assert.match(page, /const toCircuitPayload = \(circuit: HarnessCircuitSpec\)/);
  assert.match(page, /map\(toCircuitPayload\)/);
  assert.doesNotMatch(page, /\.\.\.circuit,\s*\n\s*circuitNo:/);
  assert.doesNotMatch(page, /circuitId:\s*circuit\.circuitId/);
  assert.doesNotMatch(page, /revisionId:\s*circuit\.revisionId/);
});

test('production specification setup uses a modal for revise and cancel does not call API', () => {
  const page = read('apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx');

  assert.doesNotMatch(page, /window\.prompt/);
  assert.match(page, /reviseModalOpen/);
  assert.match(page, /confirmReviseDrawing/);
  assert.match(page, /<Modal[\s\S]*title="Rev 생성"/);
  assert.match(page, /onClick=\{\(\) => setReviseModalOpen\(false\)\}/);
});
