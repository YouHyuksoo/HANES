import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./ship-history.dto.ts', import.meta.url), 'utf8');

test('ship history status filter accepts CLOSED history rows', () => {
  assert.match(source, /SHIP_ORDER_STATUS[\s\S]*'CLOSED'/, 'CLOSED should be a valid history status filter');
});
