import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./defectColumns.tsx', import.meta.url), 'utf8');

test('defect page delegates grid columns to defectColumns', () => {
  assert.match(page, /createDefectGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"occurAt"/);
});

test('defect columns keep required accessors and action wiring', () => {
  for (const key of ['occurAt', 'workOrderNo', 'defectCode', 'defectName', 'qty', 'status', 'operator', 'cause']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'actions'/);
  assert.match(columns, /onOpenStatusModal/);
  assert.match(columns, /onOpenDeleteModal/);
  assert.match(columns, /StatusHeaderHelp/);
});
