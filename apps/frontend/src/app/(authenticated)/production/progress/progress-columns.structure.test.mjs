import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./progressColumns.tsx', import.meta.url), 'utf8');

test('progress page delegates grid columns to progressColumns', () => {
  assert.match(page, /createProgressGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*'orderNo'/);
});

test('progress columns keep required accessors and progress/status renderers', () => {
  for (const key of ['orderNo', 'lineCode', 'processCode', 'equipCode', 'planQty', 'goodQty', 'defectQty', 'status', 'planDate']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'progress'/);
  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /ComCodeBadge/);
});
