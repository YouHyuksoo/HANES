import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';

const repoRoot = process.cwd();
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8');
const exists = (path) => existsSync(resolve(repoRoot, path));

test('DataGrid does not render hover edge scroll handles', () => {
  const grid = read('apps/frontend/src/components/data-grid/DataGrid.tsx');

  assert.doesNotMatch(grid, /ScrollHandle/);
  assert.doesNotMatch(grid, /group\/scroll/);
  assert.doesNotMatch(grid, /with scroll handles/i);
});

test('DataGrid hover edge auto-scroll implementation is removed', () => {
  assert.equal(exists('apps/frontend/src/components/data-grid/ScrollHandle.tsx'), false);
});
