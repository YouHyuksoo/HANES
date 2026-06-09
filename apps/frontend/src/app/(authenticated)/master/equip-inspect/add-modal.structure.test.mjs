import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./components/AddInspectItemModal.tsx', import.meta.url), 'utf8');

test('add inspect item modal exposes inspection type before pool item selection', () => {
  const typeLabelIndex = source.indexOf('label={t("master.equipInspect.inspectType")}');
  const itemLabelIndex = source.indexOf('label={t("master.equipInspect.itemName", "점검항목")}');

  assert.notEqual(typeLabelIndex, -1);
  assert.notEqual(itemLabelIndex, -1);
  assert.ok(typeLabelIndex < itemLabelIndex, 'inspect type select should appear before pool item select');
});

test('add inspect item modal filters pool items by selected inspection type', () => {
  assert.match(source, /inspectType,\s*limit:\s*"1000"/);
});
