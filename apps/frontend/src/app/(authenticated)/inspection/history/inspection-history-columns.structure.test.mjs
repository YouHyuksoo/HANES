import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./inspectionHistoryColumns.tsx', import.meta.url), 'utf8');

test('inspection history page delegates grid columns to inspectionHistoryColumns', () => {
  assert.match(page, /createInspectionHistoryGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"inspectAt"/);
});

test('inspection history columns keep required accessors and display rules', () => {
  for (const key of ['inspectAt', 'inspectType', 'fgBarcode', 'passYn', 'errorCode', 'errorDetail', 'inspectorId', 'inspectScope']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /inspectTypeClass/);
  assert.match(columns, /getInspectTypeLabel/);
  assert.match(columns, /CheckCircle/);
  assert.match(columns, /XCircle/);
});
