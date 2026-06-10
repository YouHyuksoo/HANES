import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = process.cwd();

const read = (relativePath) => readFileSync(join(root, relativePath), 'utf8');

test('DataGrid column filter inputs disable browser autocomplete history', () => {
  const columnFilterInput = read('apps/frontend/src/components/data-grid/ColumnFilterInput.tsx');
  const textFilterPopup = read('apps/frontend/src/components/data-grid/TextFilterPopup.tsx');
  const numberFilterPopup = read('apps/frontend/src/components/data-grid/NumberFilterPopup.tsx');
  const dateFilterPopup = read('apps/frontend/src/components/data-grid/DateFilterPopup.tsx');

  assert.match(
    columnFilterInput,
    /<input[\s\S]*?type="text"[\s\S]*?autoComplete="off"[\s\S]*?autoCorrect="off"[\s\S]*?spellCheck=\{false\}/,
    'text column filter input should not show browser autocomplete suggestions',
  );

  assert.match(
    textFilterPopup,
    /<input[\s\S]*?type="text"[\s\S]*?autoComplete="off"[\s\S]*?autoCorrect="off"[\s\S]*?spellCheck=\{false\}/,
    'multi-text filter popup search input should not show browser autocomplete suggestions',
  );

  assert.equal(
    [...numberFilterPopup.matchAll(/<input[\s\S]*?type="number"[\s\S]*?autoComplete="off"[\s\S]*?inputMode="decimal"/g)].length,
    2,
    'number filter popup should disable autocomplete on both number condition inputs',
  );

  assert.equal(
    [...dateFilterPopup.matchAll(/<input[\s\S]*?type="date"[\s\S]*?autoComplete="off"/g)].length,
    2,
    'date filter popup should disable autocomplete on from/to date inputs',
  );
});
