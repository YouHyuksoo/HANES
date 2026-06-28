import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./moldColumns.tsx', import.meta.url), 'utf8');

test('mold page delegates grid columns to moldColumns', () => {
  assert.match(page, /createMoldGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*'moldCode'/);
});

test('mold columns keep required accessors and status helpers', () => {
  for (const key of ['moldCode', 'moldName', 'terminalName', 'currentShots', 'expectedLife', 'status']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
