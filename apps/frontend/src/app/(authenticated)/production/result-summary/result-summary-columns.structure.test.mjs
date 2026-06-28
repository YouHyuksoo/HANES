import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./resultSummaryColumns.tsx', import.meta.url), 'utf8');

test('result summary page delegates grid columns to resultSummaryColumns', () => {
  assert.match(page, /createResultSummaryGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"itemCode"/);
});

test('result summary columns keep required accessors and rate cell', () => {
  for (const key of ['itemCode', 'itemName', 'itemType', 'lineCode', 'totalPlanQty', 'totalGoodQty', 'totalDefectQty', 'achieveRate', 'yieldRate', 'defectRate', 'orderCount']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /function rateCell/);
});
