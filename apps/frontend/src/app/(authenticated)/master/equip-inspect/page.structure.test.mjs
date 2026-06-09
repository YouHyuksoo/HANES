import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('master equip inspect page exposes the inspection item master tab', () => {
  assert.match(pageSource, /ItemMasterTab/);
  assert.match(pageSource, /tabMaster/);
});
