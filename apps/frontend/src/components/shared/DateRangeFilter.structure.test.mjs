import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./DateRangeFilter.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('DateRangeFilter has controlled from/to props', () => {
  assert.match(src, /from: string/);
  assert.match(src, /to: string/);
  assert.match(src, /onFromChange: \(v: string\) => void/);
  assert.match(src, /onToChange: \(v: string\) => void/);
});

test('DateRangeFilter renders two date inputs and a separator', () => {
  const dateInputs = src.match(/type="date"/g) || [];
  assert.equal(dateInputs.length, 2);
  assert.match(src, /~/);
});

test('DateRangeFilter wires presets to range helpers', () => {
  assert.match(src, /getRecentDaysRange\(7\)/);
  assert.match(src, /getThisMonthRange\(\)/);
  assert.match(src, /getTodayLocal\(\)/);
  assert.match(src, /common\.dateFilter\.today/);
  assert.match(src, /common\.dateFilter\.recent7/);
  assert.match(src, /common\.dateFilter\.thisMonth/);
});

test('DateRangeFilter clamps from>to (auto-correct)', () => {
  assert.match(src, /v > to/);
  assert.match(src, /v < from/);
});

test('shared index exports DateRangeFilter', () => {
  assert.match(index, /export \{ default as DateRangeFilter \} from ".\/DateRangeFilter"/);
  assert.match(index, /export type \{ DateRangeFilterProps \}/);
});
