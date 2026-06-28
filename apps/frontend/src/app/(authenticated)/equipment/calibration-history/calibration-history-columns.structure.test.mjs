import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./calibrationHistoryColumns.tsx', import.meta.url), 'utf8');

test('calibration history page delegates grid columns to calibrationHistoryColumns', () => {
  assert.match(page, /createCalibrationHistoryGridColumns/);
  assert.doesNotMatch(page, /ColumnDef</);
  assert.doesNotMatch(page, /accessorKey:\s*"calibrationDate"/);
});

test('calibration history columns keep required accessors and status helpers', () => {
  for (const key of ['calibrationDate', 'calibrationNo', 'gaugeCode', 'gaugeName', 'result', 'calibrationOrg', 'calibrator', 'certificateNo', 'measuredValue', 'referenceValue']) {
    assert.match(columns, new RegExp(`accessorKey:\\s*'${key}'`));
  }

  assert.match(columns, /StatusHeaderHelp/);
  assert.match(columns, /StatusBadge/);
});
