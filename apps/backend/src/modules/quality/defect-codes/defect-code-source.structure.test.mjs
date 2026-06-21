import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('IQC AQL defect severity lookup uses dedicated defect code master', () => {
  const service = readFileSync('apps/backend/src/modules/quality/aql/services/aql.service.ts', 'utf8');
  assert.match(service, /DefectCodeMaster/);
  assert.doesNotMatch(service, /groupCode:\s*'DEFECT_TYPE'/);
  assert.doesNotMatch(service, /comCodeRepo\.find/);
});

test('IQC material modal does not load defect codes from COM_CODES DEFECT_TYPE', () => {
  const modal = readFileSync('apps/frontend/src/components/material/IqcModal.tsx', 'utf8');
  assert.doesNotMatch(modal, /useComCodeList\('DEFECT_TYPE'\)/);
  assert.match(modal, /\/quality\/defect-codes\/options/);
});
