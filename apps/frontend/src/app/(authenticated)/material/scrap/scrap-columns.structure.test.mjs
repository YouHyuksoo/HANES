import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./scrapColumns.tsx', import.meta.url), 'utf8');
const registerPanel = readFileSync(new URL('./components/ScrapRegisterPanel.tsx', import.meta.url), 'utf8');
const registerModal = readFileSync(new URL('./components/ScrapRegisterModal.tsx', import.meta.url), 'utf8');

test('scrap page delegates grid columns to scrapColumns', () => {
  assert.match(page, /createScrapGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"transDate"/);
});

test('scrap page does not render top summary info cards', () => {
  assert.doesNotMatch(page, /StatCard/);
  assert.doesNotMatch(page, /const\s+stats\s*=/);
  assert.doesNotMatch(page, /material\.scrap\.totalCount/);
  assert.doesNotMatch(page, /material\.scrap\.totalQty/);
});

test('scrap stock lookups do not send unsupported limit query to inventory stocks API', () => {
  assert.doesNotMatch(registerPanel, /\/inventory\/stocks[\s\S]*?limit\s*:/);
  assert.doesNotMatch(registerModal, /\/inventory\/stocks[\s\S]*?limit\s*:/);
});

test('scrap columns keep required accessors', () => {
  for (const key of ['transDate', 'transNo', 'itemCode', 'itemName', 'matUid', 'qty', 'warehouseName', 'remark']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }
});
