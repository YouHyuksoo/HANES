import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./pmPlanColumns.tsx', import.meta.url), 'utf8');

test('pm plan page delegates grid columns to pmPlanColumns', () => {
  assert.match(page, /createPmPlanGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"planCode"/);
});

test('pm plan columns keep required accessors and action wiring', () => {
  for (const key of ['planCode', 'equip', 'planName', 'pmType', 'cycleType', 'itemCount', 'nextDueAt', 'useYn']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /id:\s*'actions'/);
  assert.match(columns, /id:\s*'equipName'/);
  assert.match(columns, /onEditPlan/);
  assert.match(columns, /onDeletePlan/);
  assert.match(columns, /ComCodeBadge/);
});
