import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/receive/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/receive/productReceiveColumns.tsx', 'utf8');

test('/product/receive extracts DataGrid columns into productReceiveColumns.tsx factory', () => {
  assert.match(columns, /export function createProductReceiveGridColumns\(/);
  assert.match(columns, /\}: CreateProductReceiveGridColumnsOptions\): ColumnDef<ProductTransaction>\[\]/);
});

test('/product/receive page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductReceiveGridColumns, type ProductTransaction \} from "\.\/productReceiveColumns"/);
  assert.match(page, /createProductReceiveGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transDate"/);
});
