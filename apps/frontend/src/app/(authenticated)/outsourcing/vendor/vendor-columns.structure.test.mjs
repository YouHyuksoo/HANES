import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./vendorColumns.tsx', import.meta.url), 'utf8');

test('outsourcing vendor page delegates grid columns to vendorColumns', () => {
  assert.match(page, /createVendorGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"vendorCode"/);
});

test('outsourcing vendor columns keep required accessors and edit action', () => {
  for (const key of ['vendorCode', 'vendorName', 'vendorType', 'bizNo', 'ceoName', 'contactPerson', 'tel', 'address', 'useYn']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'actions'/);
  assert.match(columns, /onEditVendor/);
  assert.match(columns, /getVendorTypeLabel/);
});
