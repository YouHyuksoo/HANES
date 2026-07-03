import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const pagePath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/input-assembly/page.tsx',
);
const source = readFileSync(pagePath, 'utf8');
const jobOrderModalPath = join(
  process.cwd(),
  'apps/frontend/src/components/production/JobOrderSelectModal.tsx',
);
const jobOrderModalSource = readFileSync(jobOrderModalPath, 'utf8');
const sgScanPanelPath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/input-assembly/components/SgScanPanel.tsx',
);
const sgScanPanelSource = readFileSync(sgScanPanelPath, 'utf8');

test('/production/input-assembly: selected equipment is persisted locally for reboot restore', () => {
  assert.match(source, /ASSEMBLY_SELECTED_EQUIP_KEY/);
  assert.match(source, /window\.localStorage\.setItem\(ASSEMBLY_SELECTED_EQUIP_KEY, equip\.equipCode\)/);
  assert.match(source, /window\.localStorage\.getItem\(ASSEMBLY_SELECTED_EQUIP_KEY\)/);
});

test('/production/input-assembly: equipment current job order is restored from server', () => {
  assert.match(source, /restoreEquipmentCurrentState/);
  assert.match(source, /currentJobOrderId/);
  assert.match(source, /\/production\/job-orders\/order-no\/\$\{encodeURIComponent\(currentJobOrderId\)\}/);
  assert.match(source, /selectOrder\(toJobOrderPick\(restored\), \{ persist: false \}\)/);
});

test('/production/input-assembly: job order selection persists to equipment current state', () => {
  assert.match(source, /persistCurrentJobOrder/);
  assert.match(source, /\/equipment\/equips\/\$\{encodeURIComponent\(targetEquipCode\)\}\/job-order/);
  assert.match(source, /\{ orderNo \}/);
});

test('/production/input-assembly: typed job order lookup uses operation and assignable equipment filters', () => {
  assert.match(source, /statuses: "WAITING,RUNNING"/);
  assert.match(source, /orderKind: "OPERATION"/);
  assert.match(source, /itemType: "FINISHED"/);
  assert.match(source, /assignableEquipCode: equipCode/);
});

test('/production/input-assembly: modal uses FINISHED operation filters and current equipment', () => {
  assert.match(source, /filterStatus=\{\['WAITING', 'RUNNING'\]\}/);
  assert.match(source, /equipCode=\{equipCode \|\| undefined\}/);
  assert.match(source, /processCode=\{processCode \|\| undefined\}/);
  assert.match(source, /itemType="FINISHED"/);
  assert.match(source, /orderKind="OPERATION"/);
});

test('/production/input-assembly: material mount panel receives order BOM context', () => {
  assert.match(source, /<EquipMaterialMountPanel[\s\S]*orderNo=\{selectedOrder\?\.orderNo\}/);
  assert.match(source, /<EquipMaterialMountPanel[\s\S]*itemCode=\{selectedOrder\?\.itemCode\}/);
  assert.match(source, /expectedItemTypes=\{\["RAW_MATERIAL"\]\}/);
  assert.match(source, /autoFocusKey=\{selectedOrder\?\.orderNo\}/);
});

test('/production/input-assembly: UI fallback wording uses SFG, not SG, for semi-finished labels', () => {
  assert.doesNotMatch(source, /SG 라벨|SG 바코드|SG 스캔/);
  assert.doesNotMatch(sgScanPanelSource, /SG 라벨|SG 바코드|SG 스캔|반제품\(SG\)/);
  assert.match(source, /SFG 라벨/);
  assert.match(sgScanPanelSource, /SFG 바코드/);
});

test('JobOrderSelectModal: equipment filter allows unassigned operation orders', () => {
  assert.match(jobOrderModalSource, /assignableEquipCode: equipCode/);
  assert.match(jobOrderModalSource, /allowUnassignedEquip && !item\.equipCode/);
  assert.match(jobOrderModalSource, /현재\/미배정/);
});
