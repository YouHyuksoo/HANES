import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./scrapColumns.tsx', import.meta.url), 'utf8');

test('scrap page delegates grid columns to scrapColumns', () => {
  assert.match(page, /createScrapGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"transDate"/);
});

test('scrap columns keep required accessors', () => {
  for (const key of ['transDate', 'transNo', 'itemCode', 'itemName', 'matUid', 'qty', 'warehouseName', 'remark']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }
});
