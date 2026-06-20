import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./IqcSpecPanel.tsx', import.meta.url), 'utf8');

test('검사유형 공통코드 옵션을 사용한다', () => {
  assert.match(src, /useComCodeOptions\("IQC_ITEM_INSP_TYPE"\)/);
});
test('save body에 inspectionType/sampleMethod/sampleQty가 포함된다', () => {
  assert.match(src, /inspectionType: it\.inspectionType/);
  assert.match(src, /sampleQty: it\.sampleQty/);
});
test('파괴/전수 검사유형일 때만 샘플수 입력을 노출한다', () => {
  assert.match(src, /inspectionType === 'DESTRUCTIVE' \|\| draft\.inspectionType === 'FULL'/);
});
