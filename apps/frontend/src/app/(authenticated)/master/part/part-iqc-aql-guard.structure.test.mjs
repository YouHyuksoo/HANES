import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx', 'utf8');
const modal = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx', 'utf8');

test('/master/part requires AQL policy only for IQC inspected parts', () => {
  for (const source of [panel, modal]) {
    assert.match(source, /const requiresIqcAqlPolicy = form\.iqcYn === "Y"[\s\S]*!NO_INSPECTION_METHODS\.has\(form\.inspectMethod\.toUpperCase\(\)\)/);
    assert.match(source, /const canSave = !saving[\s\S]*!requiresIqcAqlPolicy \|\| !!form\.iqcAqlPolicyCode/);
    assert.match(source, /if \(!canSave\) return;/);
    assert.match(source, /<FieldSelect field="iqcAqlPolicyCode" label=\{t\("master\.part\.iqcAqlPolicyCode", "AQL 정책"\)\}[\s\S]*required=\{requiresIqcAqlPolicy\}/);
    assert.match(source, /<Button[\s\S]*disabled=\{!canSave\}/);
  }
});

test('/master/part treats SKIP and NONE as no-inspection methods for AQL policy guard', () => {
  for (const source of [panel, modal]) {
    assert.match(source, /const NO_INSPECTION_METHODS = new Set\(\["SKIP", "NONE"\]\)/);
  }
});
