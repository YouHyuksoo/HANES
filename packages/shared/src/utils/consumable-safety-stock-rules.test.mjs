import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('./consumable-safety-stock-rules.ts', import.meta.url);

async function loadRules() {
  if (!existsSync(sourceUrl)) return {};

  const source = readFileSync(sourceUrl, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

test('안전재고 이하이면 부족으로 판정하고 모자란 수량을 낸다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  const r = resolveConsumableSafetyLevel({ availableQty: 8, replacingQty: 0, safetyStock: 10 });
  assert.equal(r.level, 'SHORTAGE');
  assert.equal(r.effectiveQty, 8);
  assert.equal(r.shortageQty, 2);
});

test('안전재고와 같으면 부족이다 — 경계는 부족 쪽에 붙인다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  assert.equal(resolveConsumableSafetyLevel({ availableQty: 10, replacingQty: 0, safetyStock: 10 }).level, 'SHORTAGE');
});

test('안전재고와 임계 사이는 사전경고다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  const r = resolveConsumableSafetyLevel({ availableQty: 12, replacingQty: 0, safetyStock: 10 });
  assert.equal(r.level, 'PRE_ALERT');
  assert.equal(r.preAlertThreshold, 12);
  assert.equal(r.shortageQty, 0);
});

test('임계를 넘으면 정상이다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  assert.equal(resolveConsumableSafetyLevel({ availableQty: 13, replacingQty: 0, safetyStock: 10 }).level, 'NORMAL');
});

test('교체 임박 장착품은 가용재고에서 뺀다 — 재고만 세면 여유가 있어 보인다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  const withoutAdjust = resolveConsumableSafetyLevel({ availableQty: 15, replacingQty: 0, safetyStock: 10 });
  assert.equal(withoutAdjust.level, 'NORMAL');

  const withAdjust = resolveConsumableSafetyLevel({ availableQty: 15, replacingQty: 4, safetyStock: 10 });
  assert.equal(withAdjust.effectiveQty, 11);
  assert.equal(withAdjust.level, 'PRE_ALERT');
});

test('안전재고 미설정 품목은 판정하지 않는다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  for (const safetyStock of [0, null, undefined]) {
    const r = resolveConsumableSafetyLevel({ availableQty: 0, replacingQty: 0, safetyStock });
    assert.equal(r.level, 'NOT_MANAGED');
    assert.equal(r.shortageQty, 0);
  }
});

test('임계 수량은 올림한다 — 소수 재고는 없다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  const r = resolveConsumableSafetyLevel({ availableQty: 100, replacingQty: 0, safetyStock: 3 }, 1.2);
  assert.equal(r.preAlertThreshold, 4);
});

test('임계 배수가 1 미만이거나 값이 아니면 기본값으로 되돌린다', async () => {
  const { resolveConsumablePreAlertRatio, CONSUMABLE_PRE_ALERT_RATIO_DEFAULT } = await loadRules();
  for (const raw of [null, undefined, '', 'abc', 0, 0.5, -3]) {
    assert.equal(resolveConsumablePreAlertRatio(raw), CONSUMABLE_PRE_ALERT_RATIO_DEFAULT);
  }
  assert.equal(resolveConsumablePreAlertRatio('1.5'), 1.5);
  assert.equal(resolveConsumablePreAlertRatio(2), 2);
});

test('교체 임박이 재고보다 많으면 음수 여유를 그대로 보여준다', async () => {
  const { resolveConsumableSafetyLevel } = await loadRules();
  const r = resolveConsumableSafetyLevel({ availableQty: 2, replacingQty: 5, safetyStock: 4 });
  assert.equal(r.effectiveQty, -3);
  assert.equal(r.level, 'SHORTAGE');
  assert.equal(r.shortageQty, 7);
});

test('조치 필요 수준만 골라낸다', async () => {
  const { needsConsumableSafetyAction } = await loadRules();
  assert.equal(needsConsumableSafetyAction('SHORTAGE'), true);
  assert.equal(needsConsumableSafetyAction('PRE_ALERT'), true);
  assert.equal(needsConsumableSafetyAction('NORMAL'), false);
  assert.equal(needsConsumableSafetyAction('NOT_MANAGED'), false);
});
