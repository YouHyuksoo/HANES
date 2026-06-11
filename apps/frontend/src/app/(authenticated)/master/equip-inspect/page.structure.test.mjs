import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(__dir, 'page.tsx'), 'utf8');
const assignTabSource = readFileSync(join(__dir, 'components/EquipAssignTab.tsx'), 'utf8');
const panelSource = readFileSync(join(__dir, 'components/InspectItemSelectPanel.tsx'), 'utf8');
const panelSource2 = readFileSync(join(__dir, 'components/InspectItemPanel.tsx'), 'utf8');

test('page renders EquipAssignTab without ItemMasterTab', () => {
  assert.match(pageSource, /EquipAssignTab/);
  assert.doesNotMatch(pageSource, /ItemMasterTab/);
});

test('EquipAssignTab has activeTab state with 4 inspect types', () => {
  assert.match(assignTabSource, /activeTab/);
  assert.match(assignTabSource, /"DAILY"/);
  assert.match(assignTabSource, /"PERIODIC"/);
  assert.match(assignTabSource, /"PM"/);
  assert.match(assignTabSource, /"WORKER"/);
});

test('EquipAssignTab uses InspectItemSelectPanel not AddInspectItemModal', () => {
  assert.match(assignTabSource, /InspectItemSelectPanel/);
  assert.doesNotMatch(assignTabSource, /AddInspectItemModal/);
});

test('EquipAssignTab passes registeredItemCodes to panel', () => {
  assert.match(assignTabSource, /registeredItemCodes/);
});

test('InspectItemSelectPanel has checkbox multi-select and bulk save', () => {
  assert.match(panelSource, /checkedCodes/);
  assert.match(panelSource, /toggleAll/);
  assert.match(panelSource, /handleSave/);
});

test('InspectItemSelectPanel shows registered items as disabled', () => {
  assert.match(panelSource, /registeredSet/);
  assert.match(panelSource, /isRegistered/);
  assert.match(panelSource, /disabled/);
});

test('InspectItemPanel does not have inspectType column', () => {
  assert.doesNotMatch(panelSource2, /accessorKey.*inspectType/);
  assert.doesNotMatch(panelSource2, /INSPECT_TYPE_COLORS/);
});
