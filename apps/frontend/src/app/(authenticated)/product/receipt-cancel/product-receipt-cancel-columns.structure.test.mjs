import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/receipt-cancel/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/receipt-cancel/productReceiptCancelColumns.tsx', 'utf8');

test('/product/receipt-cancel extracts DataGrid columns into productReceiptCancelColumns.tsx factory', () => {
  assert.match(columns, /export function createProductReceiptCancelGridColumns\(/);
  assert.match(columns, /\}: CreateProductReceiptCancelGridColumnsOptions\): ColumnDef<ProductReceiptTx>\[\]/);
});

test('/product/receipt-cancel page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductReceiptCancelGridColumns, type ProductReceiptTx \} from "\.\/productReceiptCancelColumns"/);
  assert.match(page, /createProductReceiptCancelGridColumns\(\{[\s\S]*setSelectedTx[\s\S]*setReason[\s\S]*setIsModalOpen[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transDate"/);
});
