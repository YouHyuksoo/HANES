import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormPanel.tsx', 'utf8');
const modal = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/components/PartFormModal.tsx', 'utf8');
const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/part/page.tsx', 'utf8');
const partRules = fs.readFileSync('packages/shared/src/utils/part-rules.ts', 'utf8');
const partService = fs.readFileSync('apps/backend/src/modules/master/services/part.service.ts', 'utf8');

test('/master/part requires AQL policy only for IQC inspected parts', () => {
  for (const source of [panel, modal]) {
    assert.match(source, /import \{ requiresIqcAqlPolicy as isIqcAqlPolicyRequired \} from "@harness\/shared"/);
    assert.match(source, /const requiresIqcAqlPolicy = isIqcAqlPolicyRequired\(form\.iqcYn, form\.inspectMethod\)/);
    assert.match(source, /const canSave = !saving[\s\S]*!requiresIqcAqlPolicy \|\| !!form\.iqcAqlPolicyCode/);
    assert.match(source, /if \(!canSave\) return;/);
    assert.match(source, /<FieldSelect field="iqcAqlPolicyCode" label=\{t\("master\.part\.iqcAqlPolicyCode", "AQL 정책"\)\}[\s\S]*required=\{requiresIqcAqlPolicy\}/);
    assert.match(source, /<Button[\s\S]*disabled=\{!canSave\}/);
  }
});

test('/master/part treats SKIP and NONE as no-inspection methods for AQL policy guard', () => {
  assert.match(partRules, /export const IQC_NO_INSPECTION_METHOD_VALUES = \['SKIP', 'NONE'\] as const/);
  assert.match(partRules, /export function isIqcNoInspectionMethod\(inspectMethod\?: string \| null\): boolean/);
  assert.match(partRules, /export function requiresIqcAqlPolicy\(iqcYn\?: string \| null, inspectMethod\?: string \| null\): boolean/);
  assert.match(partService, /import \{ requiresIqcAqlPolicy \} from '@harness\/shared'/);
  assert.match(partService, /if \(!requiresIqcAqlPolicy\(input\.iqcYn, input\.inspectMethod\)\) return/);
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
