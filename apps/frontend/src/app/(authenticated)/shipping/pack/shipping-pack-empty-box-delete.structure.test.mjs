import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(
  'apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx',
  'utf8',
);

test('shipping pack exposes empty-box deletion only for empty open boxes', () => {
  assert.match(source, /Trash2/, 'empty-box deletion should be represented by a fixed delete icon');
  assert.match(source, /deleteBoxTarget/, 'delete flow should require an explicit confirmation target');
  assert.match(source, /canDeleteEmptyBox/, 'delete eligibility should be named and visible in the page logic');
  assert.match(
    source,
    /api\.delete\(`\/shipping\/boxes\/\$\{deleteBoxTarget\.boxNo\}`\)/,
    'delete action must call the existing box delete endpoint with the selected box number',
  );
});

test('shipping pack keeps box actions in a stable selection toolbar', () => {
  assert.match(
    source,
    /<div className="flex gap-1 ml-auto flex-wrap">[\s\S]*?<\/div>/,
    'box actions should live in one shared toolbar instead of per-row icon grids',
  );
  assert.match(
    source,
    /disabled=\{!selectedBox \|\| !canDeleteEmptyBox\(selectedBox\)\}/,
    'delete action must gate on selection state, not appear inline per row',
  );
  const actionButtonSizes = source.match(/<Button size="sm"/g) ?? [];
  assert.ok(actionButtonSizes.length >= 5, 'all box actions should share the same fixed button size');
});

test('shipping pack clearly shows the active box being packed', () => {
  assert.match(source, /activePackingBoxNo/, 'selected box should be tracked for row highlight');
  assert.match(source, /shipping\.pack\.currentBox/, 'serial modal should use a strong current-box label');
  assert.match(source, /ring-2 ring-primary/, 'active row should be visually highlighted');
});
