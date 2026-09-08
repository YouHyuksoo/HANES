import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('./dateTimeKst.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
new Function('exports', compiled)(exports);
const { formatDateTimeKst } = exports;

test('UTC 요청일을 한국시간으로 변환하고 날짜 경계를 넘긴다', () => {
  assert.equal(formatDateTimeKst('2026-09-08T01:25:35.632Z'), '2026-09-08 10:25');
  assert.equal(formatDateTimeKst('2026-06-30T15:34:19.859Z'), '2026-07-01 00:34');
  assert.equal(formatDateTimeKst('2026-07-01T00:34:19+09:00'), '2026-07-01 00:34');
});

test('날짜 전용값을 보존하고 없는 값이나 잘못된 값은 공란 대체한다', () => {
  assert.equal(formatDateTimeKst('2026-09-08'), '2026-09-08');
  assert.equal(formatDateTimeKst(null), '-');
  assert.equal(formatDateTimeKst('invalid'), '-');
});
