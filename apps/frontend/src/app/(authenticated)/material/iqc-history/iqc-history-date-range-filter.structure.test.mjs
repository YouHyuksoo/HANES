import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('iqc-history uses shared DateRangeFilter with today defaults', () => {
  assert.match(src, /import DateRangeFilter from "@\/components\/shared\/DateRangeFilter"/);
  assert.match(src, /<DateRangeFilter/);
  assert.match(src, /from=\{startDate\}/);
  assert.match(src, /to=\{endDate\}/);
  assert.match(src, /onFromChange=\{setStartDate\}/);
  assert.match(src, /onToChange=\{setEndDate\}/);
  assert.match(src, /const\s+\[startDate,\s*setStartDate\]\s*=\s*useState\(\(\)\s*=>\s*getTodayLocal\(\)\)/);
  assert.match(src, /const\s+\[endDate,\s*setEndDate\]\s*=\s*useState\(\(\)\s*=>\s*getTodayLocal\(\)\)/);
  // 직접 type="date" 입력은 공통 컴포넌트로 대체되어 제거됨
  assert.doesNotMatch(src, /type="date"/);
});
