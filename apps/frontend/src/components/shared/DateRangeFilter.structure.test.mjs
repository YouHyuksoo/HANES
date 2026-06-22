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

test('DateRangeFilter supports optional label rendered before the range', () => {
  assert.match(src, /label\?: string/);
  assert.match(src, /\{label &&/);
});

test('DateRangeFilter collapses presets into a toggleable icon dropdown', () => {
  // 프리셋은 옆으로 펼치지 않고 아이콘 버튼으로 접어 토글한다(공간 절약)
  assert.match(src, /CalendarRange/);
  assert.match(src, /useState\(false\)/);
  assert.match(src, /setOpen\(\(o\) => !o\)/);
  // 바깥 클릭 시 닫힘
  assert.match(src, /addEventListener\("mousedown"/);
  assert.match(src, /common\.dateFilter\.presets/);
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

const dfSrc = readFileSync(new URL('./DateFilter.tsx', import.meta.url), 'utf8');

test('DateFilter is a controlled single-date filter with today button', () => {
  assert.match(dfSrc, /value: string/);
  assert.match(dfSrc, /onChange: \(v: string\) => void/);
  assert.match(dfSrc, /todayButton\?: boolean/);
  const inputs = dfSrc.match(/type="date"/g) || [];
  assert.equal(inputs.length, 1);
  assert.match(dfSrc, /getTodayLocal\(\)/);
  assert.match(dfSrc, /common\.dateFilter\.today/);
});

test('shared index exports DateFilter', () => {
  assert.match(index, /export \{ default as DateFilter \} from ".\/DateFilter"/);
  assert.match(index, /export type \{ DateFilterProps \}/);
});
