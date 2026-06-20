import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const sharedViewPath = join(root, 'apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx');
const koLocalePath = join(root, 'apps/frontend/src/locales/ko.json');
const servicePath = join(root, 'apps/backend/src/modules/production/services/production-views.service.ts');
const controllerPath = join(root, 'apps/backend/src/modules/production/controllers/production-views.controller.ts');

test('/production/wip-stock uses the same label detail panel as finished-product stock', () => {
  const source = readFileSync(sharedViewPath, 'utf8');

  assert.doesNotMatch(source, /const showFgPanel = itemType === "FINISHED"/);
  assert.doesNotMatch(source, /showFgPanel && row\.itemType === "FINISHED"/);
  assert.doesNotMatch(source, /\{showFgPanel && \(/);
  assert.match(source, /fetchLabelDetails\(row\.itemCode,\s*row\.itemType\)/);
  assert.match(source, /t\("production\.wipStock\.labelPanelTitle"/);
  assert.match(source, /t\("production\.wipStock\.labelPanelEmpty"/);
});

test('label detail API separates semi-product SG_LABELS from finished-product FG_LABELS', () => {
  const source = readFileSync(sharedViewPath, 'utf8');
  const service = readFileSync(servicePath, 'utf8');
  const controller = readFileSync(controllerPath, 'utf8');

  assert.match(source, /api\.get\("\/production\/wip-stock\/labels"/);
  assert.match(source, /params:\s*\{\s*itemCode,\s*itemType/);
  assert.match(source, /accessorKey:\s*"labelType"/);
  assert.match(source, /accessorKey:\s*"barcode"/);
  assert.match(source, /accessorKey:\s*"remainQty"/);
  assert.doesNotMatch(source, /\/production\/wip-stock\/fg-labels/);

  assert.match(controller, /@Get\('wip-stock\/labels'\)/);
  assert.match(controller, /@Query\('itemType'\) itemType/);
  assert.match(controller, /getWipStockLabels\(itemCode,\s*itemType/);

  assert.match(service, /import \{ SgLabel \}/);
  assert.match(service, /private readonly sgLabelRepository/);
  assert.match(service, /async getWipStockLabels\(itemCode: string,\s*itemType: string/);
  assert.match(service, /itemType === 'SEMI_PRODUCT'/);
  assert.match(service, /this\.sgLabelRepository/);
  assert.match(service, /this\.fgLabelRepository/);
  assert.match(service, /'SG' AS "labelType"/);
  assert.match(service, /'FG' AS "labelType"/);
});

test('label detail panel text is generic enough for semi-product labels', () => {
  const ko = JSON.parse(readFileSync(koLocalePath, 'utf8'));

  assert.equal(ko.production.wipStock.labelPanelTitle, '상세 라벨정보');
  assert.equal(ko.production.wipStock.labelPanelEmpty, '좌측에서 품목을 선택하면 상세 라벨정보가 표시됩니다');
});
