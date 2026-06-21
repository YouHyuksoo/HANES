import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const page = readFileSync('apps/frontend/src/app/(authenticated)/quality/defect/page.tsx', 'utf8');

test('/quality/defect loads defect-code options from dedicated master API', () => {
  assert.match(page, /quality\/defect-codes\/options/);
  assert.match(page, /defectCodeOptions/);
});

test('/quality/defect no longer uses COM_CODES DEFECT_TYPE for filters or registration', () => {
  assert.doesNotMatch(page, /groupCode=["']DEFECT_TYPE["']/);
  assert.doesNotMatch(page, /useComCodeList\(["']DEFECT_TYPE["']\)/);
});

test('/quality/defect derives defectName from dedicated defect-code option', () => {
  assert.match(page, /defectCodeOptions\.find/);
  assert.match(page, /defectName/);
});
