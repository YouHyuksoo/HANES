import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/product-hold/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/product-hold/productHoldColumns.tsx', 'utf8');

test('/inventory/product-hold extracts DataGrid columns into productHoldColumns.tsx factory', () => {
  assert.match(columns, /export function createProductHoldGridColumns\(/);
  assert.match(columns, /\}: CreateProductHoldGridColumnsOptions\): ColumnDef<ProductHoldStock>\[\]/);
});

test('/inventory/product-hold page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductHoldGridColumns, type ProductHoldStock \} from "\.\/productHoldColumns"/);
  assert.match(page, /createProductHoldGridColumns\(\{[\s\S]*setSelectedStock,[\s\S]*setActionType,[\s\S]*setReason,[\s\S]*setIsModalOpen,[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "itemCode"/);
});
