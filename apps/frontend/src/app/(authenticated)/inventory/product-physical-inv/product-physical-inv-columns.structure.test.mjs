import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/product-physical-inv/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/product-physical-inv/productPhysicalInvColumns.tsx', 'utf8');

test('/inventory/product-physical-inv extracts DataGrid columns into productPhysicalInvColumns.tsx factory', () => {
  assert.match(columns, /export function createProductPhysicalInvGridColumns\(/);
  assert.match(columns, /\}: CreateProductPhysicalInvGridColumnsOptions\): ColumnDef<StockForCount>\[\]/);
});

test('/inventory/product-physical-inv page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductPhysicalInvGridColumns \} from "\.\/productPhysicalInvColumns"/);
  assert.match(page, /createProductPhysicalInvGridColumns\(\{[\s\S]*t,[\s\S]*updateCountedQty,[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "warehouseName"/);
});
