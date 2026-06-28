import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./subconOrderColumns.tsx', import.meta.url), 'utf8');

test('outsourcing order page delegates grid columns to subconOrderColumns', () => {
  assert.match(page, /createSubconOrderGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"orderNo"/);
});

test('outsourcing order columns keep required accessors and detail action', () => {
  for (const key of ['orderNo', 'vendorName', 'itemCode', 'itemName', 'orderQty', 'deliveredQty', 'receivedQty', 'orderDate', 'dueDate', 'status']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'actions'/);
  assert.match(columns, /onShowDetail/);
  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
