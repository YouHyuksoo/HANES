import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const fgPagePath = join(root, 'apps/frontend/src/app/(authenticated)/production/fg-stock/page.tsx');
const sharedViewPath = join(root, 'apps/frontend/src/app/(authenticated)/production/wip-stock/WipStockView.tsx');

test('/production/fg-stock enables a left-grid item type filter', () => {
  const fgPage = readFileSync(fgPagePath, 'utf8');
  const sharedView = readFileSync(sharedViewPath, 'utf8');

  assert.match(fgPage, /enableTypeFilter/);
  assert.match(sharedView, /enableTypeFilter\?:\s*boolean/);
  assert.match(sharedView, /typeFilter,\s*setTypeFilter/);
  assert.match(sharedView, /const typeFilterOptions = useMemo/);
  assert.match(sharedView, /<Select[\s\S]*value=\{typeFilter\}[\s\S]*onChange=\{setTypeFilter\}/);
  assert.match(sharedView, /if \(effectiveItemType\) params\.itemType = effectiveItemType/);
  assert.match(sharedView, /const sqlTypePredicate = effectiveItemType/);
});

test('/production/fg-stock removes top summary information cards', () => {
  const sharedView = readFileSync(sharedViewPath, 'utf8');

  assert.doesNotMatch(sharedView, /StatCard/);
  assert.doesNotMatch(sharedView, /const stats = useMemo/);
  assert.doesNotMatch(sharedView, /grid grid-cols-2 gap-4 flex-shrink-0/);
});
