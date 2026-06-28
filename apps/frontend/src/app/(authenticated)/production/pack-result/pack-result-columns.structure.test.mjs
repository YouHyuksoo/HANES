import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./packResultColumns.tsx', import.meta.url), 'utf8');

test('pack result page delegates grid columns to packResultColumns', () => {
  assert.match(page, /createPackResultGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*'boxNo'/);
});

test('pack result columns keep required accessors and status helpers', () => {
  for (const key of ['packDate', 'boxNo', 'itemCode', 'itemName', 'packQty', 'status', 'palletNo', 'oqcStatus', 'packer']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
