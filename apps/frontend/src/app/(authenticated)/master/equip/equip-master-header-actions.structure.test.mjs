import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const masterTabSource = readFileSync(new URL('./components/EquipMasterTab.tsx', import.meta.url), 'utf8');

test('equipment page exposes a top header action area for active tab actions', () => {
  assert.match(pageSource, /const\s+\[headerActions,\s*setHeaderActions\]/);
  assert.match(pageSource, /<div\s+className="flex\s+items-center\s+gap-2">\s*\{headerActions\}\s*<\/div>/);
  assert.match(pageSource, /<EquipMasterTab\s+onHeaderActionsChange=\{setHeaderActions\}/);
});

test('equipment master refresh and add buttons are registered into the page header, not a tab-local row', () => {
  assert.match(masterTabSource, /interface\s+EquipMasterTabProps/);
  assert.match(masterTabSource, /onHeaderActionsChange\?:\s*\(actions:\s*ReactNode\s*\|\s*null\)\s*=>\s*void/);
  assert.match(masterTabSource, /onHeaderActionsChange\(\s*<>\s*[\s\S]*fetchEquipments[\s\S]*openCreate[\s\S]*<\/>/);
  assert.doesNotMatch(masterTabSource, /className="flex\s+justify-end\s+items-center\s+mb-3\s+gap-2\s+flex-shrink-0"/);
});
