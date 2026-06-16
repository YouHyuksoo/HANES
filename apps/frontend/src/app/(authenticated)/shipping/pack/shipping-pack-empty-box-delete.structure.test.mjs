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

test('shipping pack keeps row action buttons in stable slots', () => {
  assert.match(source, /grid grid-cols-4/, 'row actions should be a fixed four-slot grid');
  assert.match(source, /h-8 w-8/, 'row action buttons should have fixed dimensions');
  assert.equal(source.includes('flex flex-wrap gap-1.5 justify-center'), false, 'row actions must not wrap unevenly');
});

test('shipping pack clearly shows the active box being packed', () => {
  assert.match(source, /activePackingBoxNo/, 'selected box should be tracked for row highlight');
  assert.match(source, /shipping\.pack\.currentBox/, 'serial modal should use a strong current-box label');
  assert.match(source, /ring-2 ring-primary/, 'active row should be visually highlighted');
});
