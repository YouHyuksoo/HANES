import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./FilterBar.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('FilterBar takes children + optional className', () => {
  assert.match(src, /children: ReactNode/);
  assert.match(src, /className\?: string/);
});

test('FilterBar standardizes the toolbar flex-wrap layout', () => {
  assert.match(src, /flex gap-3 flex-1 min-w-0 items-center flex-wrap/);
});

test('shared barrel exports FilterBar', () => {
  assert.match(index, /export \{ default as FilterBar \} from ".\/FilterBar"/);
  assert.match(index, /export type \{ FilterBarProps \}/);
});
