import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./date.ts', import.meta.url), 'utf8');

test('date.ts exports DateRange type and range helpers', () => {
  assert.match(src, /export interface DateRange/);
  assert.match(src, /export function getDefaultRange\(\): DateRange/);
  assert.match(src, /export function getRecentDaysRange\(days: number\): DateRange/);
  assert.match(src, /export function getThisMonthRange\(\): DateRange/);
});

test('range helpers build values via getTodayLocal (no UTC slice)', () => {
  // 오늘 기본값은 getTodayLocal 기반이어야 한다
  assert.match(src, /getDefaultRange[\s\S]*?getTodayLocal\(\)/);
  // UTC 밀림 유발하는 toISOString 사용 금지
  assert.doesNotMatch(src, /toISOString\(\)\.slice/);
});

test('getThisMonthRange anchors from to day 1', () => {
  assert.match(src, /new Date\(now\.getFullYear\(\), now\.getMonth\(\), 1\)/);
});
