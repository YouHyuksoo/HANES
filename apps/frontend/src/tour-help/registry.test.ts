import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTourHelp } from './registry.ts';

test('resolves current language before Korean per field', () => {
  const result = resolveTourHelp('x', 'en-US', {
    ko: { x: { title: '저장', description: '설명', warning: '주의' } },
    en: { x: { title: 'Save', description: '' } },
  }, '라벨');
  assert.equal(result.title, 'Save');
  assert.equal(result.description, '설명');
});

test('uses label when key is missing', () => {
  assert.deepEqual(resolveTourHelp('missing', 'en', {}, '라벨'), { title: '라벨', description: '라벨' });
});
