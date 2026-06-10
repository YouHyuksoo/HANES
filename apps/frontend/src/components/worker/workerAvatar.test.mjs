import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkerInitial, getWorkerDisplayName } from './workerAvatar.ts';

test('uses first character from a non-empty worker name', () => {
  assert.equal(getWorkerInitial('홍길동'), '홍');
  assert.equal(getWorkerDisplayName('홍길동'), '홍길동');
});

test('falls back when worker name is missing or blank', () => {
  assert.equal(getWorkerInitial(undefined), '?');
  assert.equal(getWorkerInitial('   '), '?');
  assert.equal(getWorkerDisplayName(undefined), '-');
  assert.equal(getWorkerDisplayName('   '), '-');
});
