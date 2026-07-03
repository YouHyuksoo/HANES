import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const issuePage = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/issue/page.tsx', 'utf8');
const issueCancelPage = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/issue-cancel/page.tsx', 'utf8');
const menuConfig = fs.readFileSync('apps/frontend/src/config/menuConfig.ts', 'utf8');
const menuValidator = fs.readFileSync('apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts', 'utf8');
const registry = fs.readFileSync('apps/frontend/src/components/layout/pageRegistry.generated.ts', 'utf8');
const defectPagePath = 'apps/frontend/src/app/(authenticated)/product/defect-transfer/page.tsx';
const columnsPath = 'apps/frontend/src/app/(authenticated)/product/defect-transfer/productDefectTransferColumns.tsx';

function readIfExists(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
}

test('/product/issue stays issue-only and does not expose defect warehouse receiving', () => {
  assert.doesNotMatch(issuePage, /DefectTransferPanel/);
  assert.doesNotMatch(issuePage, /isDefectPanelOpen/);
  assert.doesNotMatch(issuePage, /DEFECT_IN/);
  assert.match(issuePage, /transType:\s*"WIP_OUT,FG_OUT,WIP_OUT_CANCEL,FG_OUT_CANCEL"/);
});

test('/product/issue-cancel stays issue-cancel-only', () => {
  assert.doesNotMatch(issueCancelPage, /DEFECT_IN/);
  assert.doesNotMatch(issueCancelPage, /DEFECT_IN_CANCEL/);
  assert.match(issueCancelPage, /transType:\s*"WIP_OUT,FG_OUT,WIP_OUT_CANCEL,FG_OUT_CANCEL"/);
  assert.match(issueCancelPage, /new Set\(\["WIP_OUT", "FG_OUT"\]\)/);
});

test('defect warehouse receiving is registered as its own product menu route', () => {
  assert.match(menuConfig, /PROD_DEFECT_TRANSFER/);
  assert.match(menuConfig, /menu\.productMgmt\.defectTransfer/);
  assert.match(menuConfig, /\/product\/defect-transfer/);
  assert.match(menuValidator, /PROD_DEFECT_TRANSFER/);
  assert.match(registry, /case "\/product\/defect-transfer"/);
});

test('/product/defect-transfer shows target DEFECT WIP stocks on the left', () => {
  assert.equal(fs.existsSync(defectPagePath), true);
  const defectPage = readIfExists(defectPagePath);
  const columns = readIfExists(columnsPath);

  assert.match(defectPage, /fetchTargetStocks/);
  assert.match(defectPage, /api\.get\("\/inventory\/product\/stocks"/);
  assert.match(defectPage, /qualityStatus:\s*"DEFECT"/);
  assert.match(defectPage, /warehouseId:\s*"SFG_WIP"/);
  assert.match(defectPage, /warehouseId:\s*"FG_WIP"/);
  assert.match(defectPage, /targetData/);
  assert.match(defectPage, /historyData/);
  assert.match(defectPage, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.match(columns, /createProductDefectTargetGridColumns/);
});

test('/product/defect-transfer posts defect transfer from selected target stock and keeps history on the right', () => {
  assert.equal(fs.existsSync(defectPagePath), true);
  const defectPage = readIfExists(defectPagePath);

  assert.match(defectPage, /api\.post\("\/inventory\/product\/defect-transfer"/);
  assert.match(defectPage, /fromWarehouseId:\s*selectedStock\.warehouseCode/);
  assert.match(defectPage, /itemCode:\s*selectedStock\.itemCode/);
  assert.match(defectPage, /itemType:\s*selectedStock\.itemType/);
  assert.match(defectPage, /transType:\s*"DEFECT_IN,DEFECT_IN_CANCEL"/);
  assert.match(defectPage, /api\.post\("\/inventory\/cancel"/);
  assert.match(defectPage, /source:\s*"product"/);
});
