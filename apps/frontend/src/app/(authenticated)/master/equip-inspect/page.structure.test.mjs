import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(__dir, 'page.tsx'), 'utf8');
const assignTabSource = readFileSync(join(__dir, 'components/EquipAssignTab.tsx'), 'utf8');
const modalSource = readFileSync(join(__dir, 'components/AddInspectItemModal.tsx'), 'utf8');
const panelSource = readFileSync(join(__dir, 'components/InspectItemPanel.tsx'), 'utf8');

test('master equip inspect page renders the equipment assign view without the item master tab', () => {
  assert.match(pageSource, /EquipAssignTab/);
  assert.doesNotMatch(pageSource, /ItemMasterTab/);
  assert.doesNotMatch(pageSource, /tabMaster/);
});

test('EquipAssignTab has activeTab state with 4 inspect types', () => {
  assert.match(assignTabSource, /activeTab/);
  assert.match(assignTabSource, /"DAILY"/);
  assert.match(assignTabSource, /"PERIODIC"/);
  assert.match(assignTabSource, /"PM"/);
  assert.match(assignTabSource, /"WORKER"/);
});

test('EquipAssignTab renders 4 tab buttons via INSPECT_TABS', () => {
  assert.match(assignTabSource, /INSPECT_TABS/);
  assert.match(assignTabSource, /setActiveTab/);
  assert.match(assignTabSource, /filteredItems/);
});

test('AddInspectItemModal does not have internal inspectType state', () => {
  assert.doesNotMatch(modalSource, /useState.*"DAILY"/);
  assert.doesNotMatch(modalSource, /setInspectType/);
});

test('AddInspectItemModal has equipType ComCodeSelect', () => {
  assert.match(modalSource, /selectedEquipType/);
  assert.match(modalSource, /EQUIP_TYPE/);
  assert.match(modalSource, /ComCodeSelect/);
});

test('InspectItemPanel does not have inspectType column', () => {
  assert.doesNotMatch(panelSource, /accessorKey.*inspectType/);
  assert.doesNotMatch(panelSource, /INSPECT_TYPE_COLORS/);
});
