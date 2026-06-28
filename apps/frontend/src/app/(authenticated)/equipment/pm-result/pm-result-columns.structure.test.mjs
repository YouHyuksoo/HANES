import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./pmResultColumns.tsx', import.meta.url), 'utf8');

test('pm result page delegates grid columns to pmResultColumns', () => {
  assert.match(page, /createPmResultGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"workOrderNo"/);
});

test('pm result columns keep required accessors and display rules', () => {
  for (const key of ['workOrderNo', 'scheduledDate', 'status', 'overallResult', 'priority', 'completedAt', 'remark']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'equipCode'/);
  assert.match(columns, /id:\s*'equipName'/);
  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
  assert.match(columns, /resultColors/);
  assert.match(columns, /priorityColors/);
});
