import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./inspectHistoryColumns.tsx', import.meta.url), 'utf8');

test('inspect history page delegates grid columns to inspectHistoryColumns', () => {
  assert.match(page, /createInspectHistoryGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"inspectDate"/);
});

test('inspect history columns keep required accessors and code badges', () => {
  for (const key of ['inspectDate', 'inspectType', 'equipCode', 'equipName', 'equipType', 'inspectorName', 'overallResult', 'remark']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /formatInspectDate/);
  assert.match(columns, /ComCodeBadge/);
  assert.match(columns, /INSPECT_CHECK_TYPE/);
  assert.match(columns, /INSPECT_JUDGE/);
  assert.match(columns, /EQUIP_TYPE/);
});
