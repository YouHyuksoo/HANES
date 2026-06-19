import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const materialListSource = readFileSync(new URL('./MaterialListPanel.tsx', import.meta.url), 'utf8');
const consumableScanSource = readFileSync(new URL('./ConsumableScanModal.tsx', import.meta.url), 'utf8');

test('material panel reloads scanned material lots from the job-order DB table', () => {
  assert.match(materialListSource, /\/production\/job-orders\/\$\{selectedJobOrder\.orderNo\}\/material-lots/);
  assert.match(materialListSource, /addScannedMaterialLot\(\{\s*itemCode:\s*l\.itemCode,\s*seq:\s*l\.seq,\s*matUid:\s*l\.matUid,\s*initQty:\s*l\.initQty\s*\}\)/);
});

test('material panel reloads mounted consumables from DB using the selected kiosk equipment', () => {
  assert.match(materialListSource, /selectedEquip/);
  assert.match(materialListSource, /\/production\/job-orders\/\$\{selectedJobOrder\.orderNo\}\/consumables/);
  assert.match(materialListSource, /params:\s*\{\s*equipCode:\s*selectedEquip\?\.equipCode,\s*includeMounted:\s*1\s*\}/);
  assert.match(materialListSource, /\[selectedJobOrder\?\.orderNo,\s*selectedEquip\?\.equipCode,\s*consumableRefreshSeq\]/);
});

test('consumable scan modal uses the same selected equipment for list reload and scan mount', () => {
  assert.match(consumableScanSource, /selectedEquip/);
  assert.match(consumableScanSource, /params:\s*\{\s*equipCode:\s*selectedEquip\?\.equipCode,\s*includeMounted:\s*1\s*\}/);
  assert.match(consumableScanSource, /\{\s*conUid,\s*equipCode:\s*selectedEquip\?\.equipCode\s*\}/);
  assert.match(consumableScanSource, /\[isOpen,\s*selectedJobOrder\?\.orderNo,\s*selectedEquip\?\.equipCode,\s*consumableRefreshSeq\]/);
});
