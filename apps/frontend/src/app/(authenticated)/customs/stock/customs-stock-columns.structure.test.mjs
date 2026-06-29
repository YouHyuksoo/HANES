import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./customsStockColumns.tsx', import.meta.url), 'utf8');

test('customs stock page delegates grid columns to customsStockColumns', () => {
  assert.match(page, /createCustomsStockGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"entryNo"/);
});

test('customs stock columns keep required accessors and status helpers', () => {
  for (const key of ['entryNo', 'matUid', 'itemCode', 'itemName', 'origin', 'qty', 'usedQty', 'remainQty', 'status', 'declarationDate']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
