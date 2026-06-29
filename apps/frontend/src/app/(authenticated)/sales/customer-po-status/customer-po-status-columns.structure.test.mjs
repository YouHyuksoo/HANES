import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./customerPoStatusColumns.tsx', import.meta.url), 'utf8');

test('customer PO status page delegates grid columns to customerPoStatusColumns', () => {
  assert.match(page, /createCustomerPoStatusGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"orderNo"/);
});

test('customer PO status columns keep required accessors and progress display', () => {
  for (const key of ['orderNo', 'customerName', 'dueDate', 'orderQty', 'shippedQty', 'shipRate', 'remainQty', 'status']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
  assert.match(columns, /barColor/);
});
