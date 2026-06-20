import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./IqcModal.tsx', import.meta.url), 'utf8');

test('AQL 항목과 파괴검사 항목을 분리한다', () => {
  assert.match(src, /const aqlItems = useMemo/);
  assert.match(src, /const destructItems = useMemo/);
});
test('시리얼 매트릭스는 aqlItems로 생성한다', () => {
  assert.doesNotMatch(src, /createMeasurementRows\(inspectItems\)/);
  assert.match(src, /createMeasurementRows\(aqlItems\)/);
});
test('제출 payload에 destructive를 포함한다', () => {
  assert.match(src, /destructive: destructivePayload/);
});
