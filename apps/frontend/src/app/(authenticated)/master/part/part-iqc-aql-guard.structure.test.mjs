import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx', 'utf8');
const modal = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx', 'utf8');
const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/page.tsx', 'utf8');

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

test('/master/part exposes IQC server-side filters', () => {
  assert.match(page, /const \[iqcYnFilter, setIqcYnFilter\] = useState\(""\)/);
  assert.match(page, /const \[inspectMethodFilter, setInspectMethodFilter\] = useState\(""\)/);
  assert.match(page, /const \[aqlPolicyFilter, setAqlPolicyFilter\] = useState\(""\)/);
  assert.match(page, /if \(iqcYnFilter\) params\.iqcYn = iqcYnFilter/);
  assert.match(page, /if \(inspectMethodFilter\) params\.inspectMethod = inspectMethodFilter/);
  assert.match(page, /if \(aqlPolicyFilter\) params\.iqcAqlPolicyCode = aqlPolicyFilter/);
  assert.match(page, /<UseYnSelect value=\{iqcYnFilter\} onChange=\{setIqcYnFilter\}/);
  assert.match(page, /<ComCodeSelect groupCode="IQC_INSPECT_METHOD" value=\{inspectMethodFilter\} onChange=\{setInspectMethodFilter\}/);
  assert.match(page, /<Select options=\{aqlPolicyOptions\} value=\{aqlPolicyFilter\} onChange=\{setAqlPolicyFilter\}/);
  assert.match(page, /__NONE__/);
});
