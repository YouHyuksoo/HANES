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

test('IqcModal: FULL/DESTRUCTIVE-only items fall back to manual serial PASS/FAIL (defect 05, 2026-09-09)', () => {
  const src = readFileSync(new URL('./IqcModal.tsx', import.meta.url), 'utf8');
  // 측정표 분기는 AQL 항목 유무로 판단해야 한다 (전수검사 항목만 있으면 표가 비고 시리얼이 '대기'로 남던 결함)
  assert.match(src, /const hasInspectItems = aqlItems\.length > 0;/);
  assert.doesNotMatch(src, /const hasInspectItems = inspectItems\.length > 0;/);
  assert.match(src, /material\.iqc\.manualJudgeDestructHint/);
});
