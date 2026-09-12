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
  assert.match(source, /setInterlock\('workerInspectDone', Boolean\(d\?\.inspectPassed\)\)/);
});

// 인터록은 "점검 기록이 있다"가 아니라 "종합판정이 PASS다"를 기준으로 한다.
// 완료했어도 종합판정 NG면 작업을 진행할 수 없고, 재점검으로 PASS가 되어야 풀린다.
test('input kiosk gates production on inspection judgment, not on record existence', () => {
  assert.match(source, /setInterlock\('dailyInspectDone', Boolean\(d\?\.inspectPassed\)\)/);
  assert.doesNotMatch(source, /setInterlock\('dailyInspectDone', Boolean\(d\?\.alreadyInspected\)\)/);
  assert.doesNotMatch(source, /setInterlock\('workerInspectDone', Boolean\(d\?\.alreadyInspected\)\)/);
});

// 판정 결과를 헤더에 함께 보여준다 — 완료 여부만으로는 NG를 구분할 수 없다.
test('input kiosk surfaces the overall judgment in the header badges', () => {
  assert.match(source, /setDailyInspectResult\(/);
  assert.match(source, /setWorkerInspectResult\(/);
  assert.match(source, /dailyInspectResult=\{dailyInspectResult\}/);
  assert.match(source, /workerInspectResult=\{workerInspectResult\}/);
  assert.match(source, /disabledReasons\.dailyInspectNg/);
  assert.match(source, /disabledReasons\.workerInspectNg/);
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
  // 항목 없는 시점(초/중/종물)은 완료로 본다(2026-09-09 결함 14) — 서버 게이트(assertSelfInspectGates)와 같은 규칙
  assert.match(source, /setFirstInspectDone\(selfInspectItemCounts\.FIRST === 0 \|\| latestInspectBatchPassed\(rows, 'FIRST'\)\)/);
  assert.match(source, /setMidInspectDone\(selfInspectItemCounts\.MID === 0 \|\| latestInspectBatchPassed\(rows, 'MID'\)\)/);
  assert.match(source, /setLastInspectDone\(selfInspectItemCounts\.LAST === 0 \|\| latestInspectBatchPassed\(rows, 'LAST'\)\)/);
  assert.match(source, /if \(!firstInspectDone && selfInspectItemCounts\.FIRST !== 0\)/);
  assert.match(source, /&& selfInspectItemCounts\.MID !== 0;/);
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
