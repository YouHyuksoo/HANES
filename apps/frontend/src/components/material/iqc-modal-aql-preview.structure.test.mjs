import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const modalSource = readFileSync(new URL('./IqcModal.tsx', import.meta.url), 'utf8');
const hookSource = readFileSync(new URL('../../hooks/material/useIqcData.ts', import.meta.url), 'utf8');

test('IQC modal AQL preview uses the same item-spec judgment route as arrival save', () => {
  assert.match(modalSource, /\/quality\/aql\/resolve-iqc-items/);
  assert.doesNotMatch(modalSource, /\/quality\/aql\/resolve-iqc",/);
  assert.match(modalSource, /itemResults\?: Array<\{/);
  assert.match(modalSource, /검사항목 기준/);
  assert.match(modalSource, /aqlPolicy\?\.itemResults/);
});

test('IQC modal passes vendorCode rather than display supplierName to AQL preview', () => {
  assert.match(hookSource, /vendorCode: string/);
  assert.match(hookSource, /vendorCode: g\.vendor \|\| ''/);
  assert.match(modalSource, /vendorCode: selectedItem\.vendorCode/);
  assert.doesNotMatch(modalSource, /vendorCode: selectedItem\.supplierName/);
});

test('IQC modal filters defect-code options by item defect model group', () => {
  assert.match(hookSource, /defectModelGroup: string \| null/);
  assert.match(hookSource, /defectModelGroup: g\.defectModelGroup \?\? null/);
  assert.match(modalSource, /selectedItem\.defectModelGroup/);
  assert.match(modalSource, /params:\s*selectedItem\.defectModelGroup\s*\?\s*\{\s*productType:\s*selectedItem\.defectModelGroup\s*\}\s*:\s*undefined/);
});
