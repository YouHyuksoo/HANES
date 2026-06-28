import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./structureInspectColumns.tsx', import.meta.url), 'utf8');

test('structure inspect page delegates grid columns to structureInspectColumns', () => {
  assert.match(page, /createStructureInspectGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"inspectAt"/);
});

test('structure inspect columns keep required accessors and judgement display', () => {
  for (const key of ['inspectAt', 'fgBarcode', 'passYn', 'errorCode', 'errorDetail', 'inspectorId']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /CheckCircle/);
  assert.match(columns, /XCircle/);
});
