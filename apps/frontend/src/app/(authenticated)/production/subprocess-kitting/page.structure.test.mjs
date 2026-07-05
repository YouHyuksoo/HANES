import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const pagePath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx',
);
const source = readFileSync(pagePath, 'utf8');
const jobOrderModalPath = join(
  process.cwd(),
  'apps/frontend/src/components/production/JobOrderSelectModal.tsx',
);
const jobOrderModalSource = readFileSync(jobOrderModalPath, 'utf8');
const actionBarPath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/subprocess-kitting/components/SubKitActionBar.tsx',
);
const actionBarSource = readFileSync(actionBarPath, 'utf8');
const equipMaterialMountPanelPath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/input-assembly/components/EquipMaterialMountPanel.tsx',
);
const equipMaterialMountPanelSource = readFileSync(equipMaterialMountPanelPath, 'utf8');

test('/production/subprocess-kitting: issue-sg-label POST API path is present', () => {
  assert.match(source, /\/production\/subprocess-kitting\/issue-sg-label/);
});

test('/production/subprocess-kitting: confirm-subkit POST API path is present', () => {
  assert.match(source, /\/production\/subprocess-kitting\/confirm-subkit/);
});

test('/production/subprocess-kitting: input SG scan uses sg-label lookup', () => {
  // 입력 SG 스캔 검증은 InputSgScanPanel 컴포넌트가 담당 (GET .../sg-label/:barcode)
  assert.match(source, /InputSgScanPanel/);
});

test('/production/subprocess-kitting: circuits-by-order is loaded for circuit select', () => {
  assert.match(source, /\/production\/subprocess-kitting\/circuits-by-order\//);
});

test('/production/subprocess-kitting: two-step issue -> physical confirm scan flow', () => {
  assert.match(source, /issuedSg/);
  assert.match(source, /onConfirmScan/);
});

test('/production/subprocess-kitting: SEMI_PRODUCT job order filter', () => {
  assert.match(source, /SEMI_PRODUCT/);
});

test('/production/subprocess-kitting: job order modal accepts item and routing operation orders explicitly', () => {
  assert.match(source, /filterStatus=\{\['WAITING', 'RUNNING'\]\}/);
  assert.match(source, /equipCode=\{equipCode \|\| undefined\}/);
  assert.doesNotMatch(source, /orderKind="OPERATION"/);
  assert.match(source, /includeItemOrdersForProcess/);
  assert.match(source, /itemType="SEMI_PRODUCT"/);
  assert.match(source, /SUBKIT_ORDER_KIND_META/);
  assert.match(source, /품목지시/);
  assert.match(source, /공정지시/);
});

test('/production/subprocess-kitting: typed job order lookup accepts item and routing operation orders', () => {
  assert.match(source, /statuses: "WAITING,RUNNING"/);
  assert.doesNotMatch(source, /orderKind: "OPERATION"/);
  assert.match(source, /assignableEquipCode: equipCode/);
  assert.match(source, /itemType: "SEMI_PRODUCT"/);
  assert.match(source, /isSubkitSelectableOrder/);
});

test('/production/subprocess-kitting: job order modal filters operation orders by current process while allowing item orders', () => {
  assert.match(jobOrderModalSource, /includeItemOrdersForProcess\?: boolean/);
  assert.match(jobOrderModalSource, /item\.orderKind === 'ITEM'/);
  assert.match(jobOrderModalSource, /item\.processCode === processCode/);
  assert.match(jobOrderModalSource, /getOrderKindLabel/);
  assert.match(jobOrderModalSource, /품목지시/);
  assert.match(jobOrderModalSource, /공정지시/);
});

test('/production/subprocess-kitting: confirm payload carries good-vs-defect result split', () => {
  assert.match(source, /resultQuality/);
  assert.match(source, /goodQty:\s*resultQuality === "GOOD" \? 1 : 0/);
  assert.match(source, /defectQty:\s*resultQuality === "DEFECT" \? 1 : 0/);
  assert.match(actionBarSource, /resultQuality:\s*"GOOD" \| "DEFECT"/);
  assert.match(actionBarSource, /onResultQualityChange/);
  assert.match(actionBarSource, /양품/);
  assert.match(actionBarSource, /불량/);
});

test('/production/subprocess-kitting: no alert/confirm/prompt usage', () => {
  assert.doesNotMatch(source, /\balert\s*\(/);
  assert.doesNotMatch(source, /\bconfirm\s*\(/);
  assert.doesNotMatch(source, /\bprompt\s*\(/);
});

test('/production/subprocess-kitting: issued SG label auto-print via Print Agent host', () => {
  assert.match(source, /SgLabelPrintHost/);
  assert.match(source, /sgPrinterRef\.current\?\.printBySgBarcodes/);
});

test('/production/subprocess-kitting: equipment selection focuses order scan', () => {
  assert.match(source, /setTimeout\(\(\) => orderScanRef\.current\?\.focus\(\), 80\)/);
});

test('/production/subprocess-kitting: material mount panel receives order BOM context', () => {
  assert.match(source, /<EquipMaterialMountPanel[\s\S]*orderNo=\{selectedOrder\?\.orderNo\}/);
  assert.match(source, /<EquipMaterialMountPanel[\s\S]*itemCode=\{selectedOrder\?\.itemCode\}/);
  assert.match(source, /expectedItemTypes=\{\["RAW_MATERIAL"\]\}/);
  assert.match(source, /autoFocusKey=\{selectedOrder\?\.orderNo\}/);
});

test('/production/subprocess-kitting: material scan uses job-order BOM guard endpoint when order is present', () => {
  assert.match(equipMaterialMountPanelSource, /orderNo\s*\?/);
  assert.match(equipMaterialMountPanelSource, /\/production\/job-orders\/\$\{encodeURIComponent\(orderNo\)\}\/material-mounts\/scan/);
  assert.match(equipMaterialMountPanelSource, /\/master\/boms\/parent\/\$\{encodeURIComponent\(itemCode\)\}/);
});

test('/production/subprocess-kitting: selected equipment is persisted locally for reboot restore', () => {
  assert.match(source, /SUBKIT_SELECTED_EQUIP_KEY/);
  assert.match(source, /window\.localStorage\.setItem\(SUBKIT_SELECTED_EQUIP_KEY, equip\.equipCode\)/);
  assert.match(source, /window\.localStorage\.getItem\(SUBKIT_SELECTED_EQUIP_KEY\)/);
});

test('/production/subprocess-kitting: equipment current job order is restored from server', () => {
  assert.match(source, /restoreEquipmentCurrentState/);
  assert.match(source, /currentJobOrderId/);
  assert.match(source, /\/production\/job-orders\/order-no\/\$\{encodeURIComponent\(currentJobOrderId\)\}/);
  assert.match(source, /const restoredOrder = toJobOrderPick\(restored\)/);
  assert.match(source, /isSubkitSelectableOrder\(restoredOrder, equip\.processCode \?\? ""\)/);
  assert.match(source, /selectOrder\(restoredOrder, \{ persist: false \}\)/);
});

test('/production/subprocess-kitting: job order selection persists to equipment current state', () => {
  assert.match(source, /persistCurrentJobOrder/);
  assert.match(source, /\/equipment\/equips\/\$\{encodeURIComponent\(targetEquipCode\)\}\/job-order/);
  assert.match(source, /\{ orderNo \}/);
});
