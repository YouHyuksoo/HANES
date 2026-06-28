import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./moldMgmtColumns.tsx', import.meta.url), 'utf8');

test('mold management page delegates grid columns to moldMgmtColumns', () => {
  assert.match(page, /createMoldMgmtGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"moldCode"/);
});

test('mold management columns keep required accessors and actions', () => {
  for (const key of ['moldCode', 'moldName', 'moldType', 'itemCode', 'cavity', 'currentShots', 'guaranteedShots', 'shotRate', 'status', 'nextMaintenanceDate']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'actions'/);
  assert.match(columns, /onEditMold/);
  assert.match(columns, /onDeleteMold/);
  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /ComCodeBadge/);
});
