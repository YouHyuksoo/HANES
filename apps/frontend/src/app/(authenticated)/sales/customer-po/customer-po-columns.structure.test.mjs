import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./customerPoColumns.tsx', import.meta.url), 'utf8');

test('sales customer PO page delegates grid columns to customerPoColumns', () => {
  assert.match(page, /createCustomerPoGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"orderNo"/);
});

test('sales customer PO columns keep required accessors and actions', () => {
  for (const key of ['orderNo', 'customerName', 'orderDate', 'dueDate', 'itemCount', 'totalAmount', 'status']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'actions'/);
  assert.match(columns, /onEditOrder/);
  assert.match(columns, /onDeleteOrder/);
  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
