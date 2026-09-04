import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 점검항목 추가는 단건 모달(AddInspectItemModal)에서 우측 슬라이드 일괄선택 패널로 교체됐다(d78e6932).
const source = readFileSync(new URL('./components/InspectItemSelectPanel.tsx', import.meta.url), 'utf8');

test('inspect item select panel receives the inspection type from the parent and shows it before the pool item list', () => {
  assert.match(source, /inspectType: "DAILY" \| "PERIODIC" \| "PM" \| "WORKER";/);
  const typeLabelIndex = source.indexOf('inspectTypeLabel[inspectType]');
  const listIndex = source.indexOf('registeredItemCodes');
  assert.notEqual(typeLabelIndex, -1, 'panel should display the selected inspection type');
  assert.notEqual(listIndex, -1, 'panel should know already-registered pool items');
});

test('inspect item select panel filters pool items by the selected inspection type', () => {
  assert.match(source, /inspectType,\s*limit:\s*"1000"/);
});
