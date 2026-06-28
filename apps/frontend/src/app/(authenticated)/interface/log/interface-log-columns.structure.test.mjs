import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./interfaceLogColumns.tsx', import.meta.url), 'utf8');

test('interface log page delegates grid columns to interfaceLogColumns', () => {
  assert.match(page, /createInterfaceLogGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"direction"/);
});

test('interface log columns keep required accessors and action wiring', () => {
  for (const key of ['direction', 'messageType', 'interfaceId', 'status', 'retryCount', 'createdAt', 'errorMsg']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'actions'/);
  assert.match(columns, /onShowDetail/);
  assert.match(columns, /onRetry/);
  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
