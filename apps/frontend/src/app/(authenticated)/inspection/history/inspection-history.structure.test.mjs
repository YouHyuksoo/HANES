import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const koLocale = JSON.parse(readFileSync(new URL('../../../../locales/ko.json', import.meta.url), 'utf8'));

test('inspection history shows all inspection types instead of fixed continuity history cards', () => {
  assert.doesNotMatch(pageSource, /inspectType:\s*"CONTINUITY"/);
  assert.doesNotMatch(pageSource, /<StatCard/);
  assert.doesNotMatch(pageSource, /const\s+stats\s*=/);
});

test('inspection history exposes inspection type as filter and grid column', () => {
  assert.match(pageSource, /const\s+\[typeFilter,\s*setTypeFilter\]/);
  assert.match(pageSource, /if\s*\(typeFilter\)\s*params\.inspectType\s*=\s*typeFilter/);
  assert.match(pageSource, /groupCode="INSPECT_TYPE"/);
  assert.match(pageSource, /accessorKey:\s*"inspectType"/);
  assert.match(pageSource, /외관검사/);
  assert.match(pageSource, /단자검사/);
  assert.match(pageSource, /통전검사/);
});

test('inspection history menu label is generic inspection history', () => {
  assert.equal(koLocale.menu['inspection.history'], '검사이력');
});
