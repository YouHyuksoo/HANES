import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sql = readFileSync(new URL('./2026-09-15_seed_thn_control_plan_standard.sql', import.meta.url), 'utf8');

test('THN 표준 시드는 대상 품목과 멱등 프로젝트 키를 고정한다', () => {
  assert.match(sql, /PROJECT_CODE = 'THN-STD-2026'/);
  assert.match(sql, /ITEM_CODE, ITEM_NAME, PART_NUMBER/);
  assert.match(sql, /N91H00-X9800-R-S/);
  assert.doesNotMatch(sql, /MAX\s*\(.*\)\s*\+\s*1/i);
});

test('THN 표준 시드는 A50부터 P50까지 PFD와 연결된 Control Plan 항목을 만든다', () => {
  for (const code of ['A50', 'A51', 'A52', 'B50', 'B51', 'C50', 'C51', 'C52', 'C53', 'D50', 'E50', 'F50', 'H50', 'H51', 'H52', 'H53', 'H54', 'H56', 'H57', 'I50', 'L50', 'M50', 'P50']) {
    assert.match(sql, new RegExp(`'${code}'`));
  }
  assert.match(sql, /QUALITY_PROCESS_FLOW_ROWS/);
  assert.match(sql, /QUALITY_PFMEA_ROWS/);
  assert.match(sql, /QUALITY_CONTROL_PLAN_ROWS/);
  assert.match(sql, /품질보증팀/);
});
