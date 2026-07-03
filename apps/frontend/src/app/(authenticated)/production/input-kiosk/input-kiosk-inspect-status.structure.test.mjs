import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const inputBar = readFileSync(new URL('./components/ProductionInputBar.tsx', import.meta.url), 'utf8');

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
  assert.match(source, /latestFirstInspectBatchPassed\(rows\)/);
  assert.match(source, /setFirstInspectDone\(firstInspectPassed\)/);
  assert.match(source, /setMidInspectDone\(doneTimings\.has\('MID'\)\)/);
  assert.match(source, /setLastInspectDone\(doneTimings\.has\('LAST'\)\)/);
});

test('input kiosk ignores FIRST pending delegates for production blocking before mass production', () => {
  assert.match(source, /setHasPendingDelegate\(rows\.some\(\(row: SelfInspectRow\) => row\.status === 'PENDING' && row\.timing !== 'FIRST'\)\)/);
  assert.doesNotMatch(source, /setHasPendingDelegate\(rows\.some\(\(row: \{ status\?: string \}\) => row\.status === 'PENDING'\)\)/);
});

test('input kiosk passes current automatic production type to the production input bar', () => {
  assert.match(source, /const productionType = firstInspectDone \? 'MASS' : 'TRIAL';/);
  assert.match(source, /productionType=\{productionType\}/);
});

test('production input bar displays production type but does not submit it', () => {
  assert.match(inputBar, /productionType: 'TRIAL' \| 'MASS';/);
  assert.match(inputBar, /productionType === 'MASS'/);
  assert.match(inputBar, /초물 합격 전까지 시생산으로 저장됩니다\./);
  assert.doesNotMatch(inputBar, /productionType,\s*goodQty/);
});
