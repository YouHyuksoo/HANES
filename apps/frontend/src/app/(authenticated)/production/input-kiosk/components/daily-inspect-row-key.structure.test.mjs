import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./DailyInspectModal.tsx', import.meta.url), 'utf8');

test('DailyInspectModal keys rows by list index, not by duplicated seq/sortSeq (defect 13, 2026-09-09)', () => {
  assert.match(src, /rowKey: number;/);
  assert.match(src, /rowKey: index,/);
  assert.match(src, /key=\{item\.rowKey\}/);
  assert.doesNotMatch(src, /key=\{item\.seq\}/);
  assert.doesNotMatch(src, /results\[(item|i)\.seq\]/);
  assert.doesNotMatch(src, /measureValues\[(item|i)\.seq\]/);
  assert.doesNotMatch(src, /remarks\[(item|i)\.seq\]/);
  // No 컬럼은 1부터 순번, 저장 details 키는 기존 `${seq}_${itemName}` 유지(이력 호환)
  assert.match(src, /\{item\.rowKey \+ 1\}/);
  assert.match(src, /const base = `\$\{i\.seq\}_\$\{i\.itemName\}`;/);
});

test('WorkerInspectModal uses the same rowKey scheme (same defect type as 13)', () => {
  const w = readFileSync(new URL('./WorkerInspectModal.tsx', import.meta.url), 'utf8');
  assert.match(w, /rowKey: index,/);
  assert.match(w, /key=\{item\.rowKey\}/);
  assert.doesNotMatch(w, /results\[(item|i)\.seq\]/);
  assert.doesNotMatch(w, /ngReasons\[(item|i)\.seq\]/);
  assert.match(w, /setActiveSeq\(matched\.rowKey\)/);
  // 저장 payload 의 seq 는 유지(서버/이력 호환)
  assert.match(w, /seq: i\.seq,/);
});

test('MaterialScanModal only re-evaluates the material interlock while open (defect 22)', () => {
  const m = readFileSync(new URL('./MaterialScanModal.tsx', import.meta.url), 'utf8');
  assert.match(m, /if \(!isOpen \|\| bomItems\.length === 0\) return;\s*setInterlock\('materialScanDone'/);
});

test('ProductionInputBar derives good qty from total minus defects at submit time (defect found with 18)', () => {
  const b = readFileSync(new URL('./ProductionInputBar.tsx', import.meta.url), 'utf8');
  assert.match(b, /const good = total > 0 \? Math\.max\(0, total - defect\) : parseQty\(goodQty\);/);
});
