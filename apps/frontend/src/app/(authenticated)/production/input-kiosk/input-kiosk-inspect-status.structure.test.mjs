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
  assert.match(source, /setInterlock\('workerInspectDone', Boolean\(d\?\.alreadyInspected\)\)/);
});

test('input kiosk restores current job order and workers from equipment master keys', () => {
  assert.match(source, /restoreEquipmentCurrentState/);
  assert.match(source, /currentJobOrderId/);
  assert.match(source, /currentWorkerCodes/);
  assert.match(source, /\/production\/job-orders\/order-no\/\$\{encodeURIComponent\(currentJobOrderId\)\}/);
  assert.match(source, /\/master\/workers\/\$\{encodeURIComponent\(code\)\}/);
  assert.match(source, /\/equipment\/equips\/\$\{selectedEquip\.equipCode\}\/workers/);
});

test('input kiosk restores self inspection completion state from result history', () => {
  assert.match(source, /refreshSelfInspectStatus/);
  assert.match(source, /\/production\/self-inspect\/results\/\$\{encodeURIComponent\(selectedJobOrder\.orderNo\)\}/);
  assert.match(source, /setFirstInspectDone\(doneTimings\.has\('FIRST'\)\)/);
  assert.match(source, /setMidInspectDone\(doneTimings\.has\('MID'\)\)/);
  assert.match(source, /setLastInspectDone\(doneTimings\.has\('LAST'\)\)/);
});
