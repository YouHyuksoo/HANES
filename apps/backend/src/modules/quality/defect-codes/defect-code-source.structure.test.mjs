import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('IQC AQL defect severity lookup uses dedicated defect code master', () => {
  const service = read('apps/backend/src/modules/quality/aql/services/aql.service.ts');
  assert.match(service, /DefectCodeMaster/);
  assert.doesNotMatch(service, /groupCode:\s*'DEFECT_TYPE'/);
  assert.doesNotMatch(service, /comCodeRepo\.find/);
});

test('IQC material modal does not load defect codes from COM_CODES DEFECT_TYPE', () => {
  const modal = read('apps/frontend/src/components/material/IqcModal.tsx');
  assert.doesNotMatch(modal, /useComCodeList\('DEFECT_TYPE'\)/);
  assert.match(modal, /\/quality\/defect-codes\/options/);
});

test('defect category seed follows inspection stage, model group, defect type levels', () => {
  const initialMigration = read('apps/backend/src/migrations/2026-06-21_defect_code_masters.sql');
  const reclassMigration = read('apps/backend/src/migrations/2026-06-22_reclassify_defect_categories.sql');
  const combined = `${initialMigration}\n${reclassMigration}`;

  for (const stage of ['IQC', 'LQC', 'OQC']) {
    assert.match(combined, new RegExp(`'${stage}'`));
  }
  assert.match(combined, /GROUP_CODE = 'DEFECT_MODEL_GROUP'/);
  assert.match(combined, /'LV',\s*'저전압'/);
  assert.match(combined, /'HV',\s*'고전압'/);
  assert.match(combined, /s\.CATEGORY_CODE \|\| '_' \|\| mg\.MODEL_GROUP/);
  assert.match(combined, /KIND_CODE,\s*'기능'/);
  assert.match(combined, /'APPEARANCE',\s*'외관'/);
  assert.match(combined, /'ETC',\s*'기타'/);
  assert.doesNotMatch(combined, /GROUP_CODE = 'PRODUCT_TYPE'/);
  assert.doesNotMatch(combined, /THEN '.*HARNESS/);
  assert.doesNotMatch(combined, /THEN '.*WIRE/);
  assert.match(reclassMigration, /CATEGORY_CODE NOT IN \(\s*'IQC_LV', 'IQC_HV'/);

  assert.doesNotMatch(reclassMigration, /SELECT 'APPEARANCE', '외관 불량', 1/);
  assert.doesNotMatch(reclassMigration, /SELECT 'FUNCTION', '기능 불량', 1/);
  assert.doesNotMatch(reclassMigration, /SELECT 'PROCESS', '공정 불량', 1/);
});
