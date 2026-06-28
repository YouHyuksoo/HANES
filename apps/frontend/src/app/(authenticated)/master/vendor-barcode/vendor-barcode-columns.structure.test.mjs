import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/vendor-barcode/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/vendor-barcode/vendorBarcodeColumns.tsx', 'utf8');

test('/master/vendor-barcode extracts DataGrid columns into vendorBarcodeColumns.tsx factory', () => {
  assert.match(columns, /export function createVendorBarcodeGridColumns\(/);
  assert.match(columns, /\}: CreateVendorBarcodeGridColumnsOptions\): ColumnDef<VendorBarcodeMapping>\[\]/);
});

test('/master/vendor-barcode page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createVendorBarcodeGridColumns, MATCH_TYPE_OPTIONS \} from "\.\/vendorBarcodeColumns"/);
  assert.match(page, /createVendorBarcodeGridColumns\(\{[\s\S]*onEditMapping: openEdit[\s\S]*onDeleteMapping: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "vendorBarcode"/);
});
