import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('./components/ui/Modal.tsx', import.meta.url), 'utf8');

test('중첩 Modal은 고정 ID 대신 인스턴스별 제목 ID를 사용한다', () => {
  assert.match(source, /useId\(\)/);
  assert.match(source, /aria-labelledby=\{title \? titleId : undefined\}/);
  assert.match(source, /id=\{titleId\}/);
  assert.doesNotMatch(source, /id=["']modal-title["']/);
});
