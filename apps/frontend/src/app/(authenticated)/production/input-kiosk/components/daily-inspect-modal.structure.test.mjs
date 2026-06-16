import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./DailyInspectModal.tsx', import.meta.url), 'utf8');

test('daily inspection modal uses only equipment-assigned items', () => {
  assert.match(source, /\/master\/equip-inspect-items/);
  assert.doesNotMatch(source, /\/master\/equip-inspect-item-masters/);
});

test('daily inspection modal explains how to assign missing items', () => {
  assert.match(source, /설비별로 배정된 설비일일점검 항목이 없습니다/);
  assert.match(source, /기준정보 > 설비점검항목마스터/);
  assert.match(source, /기준정보 > 설비점검항목/);
  assert.match(source, /DAILY/);
  assert.match(source, /점검항목 추가/);
});

test('daily inspection modal does not complete inspection when no items are assigned', () => {
  assert.doesNotMatch(source, /confirmWithoutItems/);
  assert.doesNotMatch(source, /항목 없음 - 자동완료/);
});

test('daily inspection modal lets backend resolve operational work date', () => {
  assert.match(source, /inspectType:\s*'DAILY'/);
  assert.doesNotMatch(source, /inspectDate:\s*today/);
  assert.doesNotMatch(source, /new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/);
});
