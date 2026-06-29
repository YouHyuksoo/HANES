import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./shipReturnColumns.tsx', import.meta.url), 'utf8');

test('shipping return page delegates grid columns to shipReturnColumns', () => {
  assert.match(page, /createShipReturnOrderGridColumns/);
  assert.match(page, /createShipReturnHistoryGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"shipOrderNo"/);
});

test('shipping return columns keep required order and return accessors', () => {
  for (const key of ['shipOrderNo', 'customerName', 'shipDate', 'shipType', 'shippedQty', 'palletCount', 'boxCount', 'hasErpSynced']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  for (const key of ['returnNo', 'shipmentId', 'returnDate', 'returnReason', 'status']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }
});
