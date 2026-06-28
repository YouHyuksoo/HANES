import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./reworkInspectColumns.tsx', import.meta.url), 'utf8');

test('rework inspect page delegates grid columns to reworkInspectColumns', () => {
  assert.match(page, /createReworkInspectGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"reworkNo"/);
});

test('rework inspect columns keep required accessors and inspect action', () => {
  for (const key of ['reworkNo', 'itemCode', 'itemName', 'reworkQty', 'resultQty', 'workerId', 'endAt', 'status']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /onOpenInspectPanel/);
  assert.match(columns, /FileSearch/);
  assert.match(columns, /ComCodeBadge/);
});
