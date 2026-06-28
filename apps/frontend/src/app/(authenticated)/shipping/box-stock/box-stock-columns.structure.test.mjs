import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/box-stock/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/box-stock/boxStockColumns.tsx', 'utf8');

test('/shipping/box-stock extracts DataGrid columns into boxStockColumns.tsx factories', () => {
  assert.match(columns, /export function createBoxStockGridColumns\(/);
  assert.match(columns, /\}: CreateBoxStockGridColumnsOptions\): ColumnDef<StockBox>\[\]/);
  assert.match(columns, /export function createBoxStockSerialGridColumns\(/);
  assert.match(columns, /\}: CreateBoxStockGridColumnsOptions\): ColumnDef<StockSerial>\[\]/);
});

test('/shipping/box-stock page consumes the extracted column factories', () => {
  assert.match(page, /import \{[\s\S]*createBoxStockGridColumns[\s\S]*createBoxStockSerialGridColumns[\s\S]*\} from "\.\/boxStockColumns"/);
  assert.match(page, /createBoxStockGridColumns\(\{[\s\S]*t[\s\S]*renderInventoryState[\s\S]*\}\)/);
  assert.match(page, /createBoxStockSerialGridColumns\(\{[\s\S]*t[\s\S]*renderInventoryState[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "fgBarcode"/);
  assert.doesNotMatch(page, /accessorKey: "boxNo"/);
});
