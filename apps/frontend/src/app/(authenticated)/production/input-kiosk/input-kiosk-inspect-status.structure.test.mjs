import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('input kiosk checks daily inspection by backend operational work date', () => {
  assert.match(source, /\/equipment\/daily-inspect\/check/);
  assert.match(source, /inspectType:\s*'DAILY'/);
  assert.doesNotMatch(source, /inspectDate:\s*today/);
});

test('input kiosk checks worker inspection by selected job order', () => {
  assert.match(source, /inspectType:\s*'WORKER'/);
  assert.match(source, /orderNo:\s*selectedJobOrder\.orderNo/);
  assert.match(source, /setInterlock\('workerInspectDone', Boolean\(res\.data\?\.data\?\.alreadyInspected\)\)/);
});
