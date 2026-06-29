import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./subconReceiveColumns.tsx', import.meta.url), 'utf8');

test('outsourcing receive page delegates grid columns to subconReceiveColumns', () => {
  assert.match(page, /createSubconReceiveGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"receiveNo"/);
});

test('outsourcing receive columns keep required accessors and status helpers', () => {
  for (const key of ['receiveNo', 'orderNo', 'vendorName', 'itemCode', 'itemName', 'qty', 'goodQty', 'defectQty', 'inspectResult', 'receivedAt', 'workerName']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
