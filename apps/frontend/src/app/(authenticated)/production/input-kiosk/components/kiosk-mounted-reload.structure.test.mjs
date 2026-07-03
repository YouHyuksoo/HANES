import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const materialListSource = readFileSync(new URL('./MaterialListPanel.tsx', import.meta.url), 'utf8');
const consumableScanSource = readFileSync(new URL('./ConsumableScanModal.tsx', import.meta.url), 'utf8');
const materialScanSource = readFileSync(new URL('./MaterialScanModal.tsx', import.meta.url), 'utf8');

test('material panel reloads mounted materials from equipment WIP using the selected kiosk equipment', () => {
  // 자재는 작업지시(material-lots)가 아니라 설비(equip-material/mounted) 귀속으로 조회한다
  assert.match(materialListSource, /\/production\/equip-material\/mounted/);
  assert.match(materialListSource, /params:\s*\{\s*equipCode:\s*selectedEquip\.equipCode\s*,?\s*\}/);
  assert.match(materialListSource, /\[selectedEquip\?\.equipCode,\s*materialMountRefreshSeq\]/);
  // 구 모델(작업지시 material-lots 재적재)이 남아있지 않아야 한다
  assert.doesNotMatch(materialListSource, /addScannedMaterialLot/);
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

test('material scan modal shows process waiting lots and selecting one reuses barcode scan mount flow', () => {
  assert.match(materialScanSource, /\/production\/equip-material\/proc-waiting/);
  assert.match(materialScanSource, /params:\s*\{\s*equipCode:\s*selectedEquip\.equipCode\s*,?\s*\}/);
  assert.match(materialScanSource, /waitingRowsToShow/);
  assert.match(materialScanSource, /unmountedBomCodes/);
  assert.match(materialScanSource, /onClick=\{\(\)\s*=>\s*handleScan\(row\.matUid\)\}/);
  assert.match(materialScanSource, /\/production\/job-orders\/\$\{selectedJobOrder\.orderNo\}\/material-mounts\/scan/);
});
