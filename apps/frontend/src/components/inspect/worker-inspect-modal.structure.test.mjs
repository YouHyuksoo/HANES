import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./WorkerInspectModal.tsx', import.meta.url), 'utf8');

test('worker inspection modal uses only equipment-assigned items', () => {
  assert.match(source, /\/master\/equip-inspect-items/);
  assert.doesNotMatch(source, /\/master\/equip-inspect-item-masters/);
});

test('worker inspection modal explains how to assign missing items', () => {
  assert.match(source, /설비별로 배정된 작업자설비점검 항목이 없습니다/);
  assert.match(source, /기준정보 > 설비점검항목/);
  assert.match(source, /설비를 선택/);
  assert.match(source, /작업자점검/);
  assert.match(source, /점검항목 추가/);
});

test('worker inspection save is keyed by selected job order', () => {
  assert.match(source, /orderNo:\s*selectedJobOrder\.orderNo/);
  assert.doesNotMatch(source, /inspectDate:\s*new Date\(\)\.toISOString\(\)\.split/);
});

test('worker inspection save buttons require selected job order', () => {
  assert.match(source, /!selectedJobOrder\?\.orderNo/);
  assert.match(source, /toast\.error\(t\('kiosk\.prep\.selectJobOrderFirst'/);
});
