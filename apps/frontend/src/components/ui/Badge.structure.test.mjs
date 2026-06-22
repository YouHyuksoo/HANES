import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./Badge.tsx', import.meta.url), 'utf8');
const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('Badge exposes variant + size props', () => {
  assert.match(src, /variant\?: BadgeVariant/);
  assert.match(src, /size\?: BadgeSize/);
  assert.match(src, /className\?: string/);
});

test('Badge defines the five status variants', () => {
  for (const v of ['info', 'success', 'warning', 'error', 'neutral']) {
    assert.match(src, new RegExp(`${v}:`));
  }
});

test('Badge renders a filled rounded-full pill (ComCodeBadge-consistent)', () => {
  assert.match(src, /rounded-full/);
  assert.match(src, /font-medium/);
  assert.match(src, /inline-flex/);
});

test('ui barrel exports Badge', () => {
  assert.match(index, /export \{ default as Badge \} from '.\/Badge'/);
  assert.match(index, /export type \{ BadgeProps, BadgeVariant, BadgeSize \}/);
});
