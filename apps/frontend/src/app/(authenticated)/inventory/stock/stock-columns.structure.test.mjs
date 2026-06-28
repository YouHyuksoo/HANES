import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/stock/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/stock/stockColumns.tsx', 'utf8');

test('/inventory/stock extracts DataGrid columns into stockColumns.tsx factory', () => {
  assert.match(columns, /export function createStockGridColumns\(/);
  assert.match(columns, /\}: CreateStockGridColumnsOptions\): ColumnDef<StockData>\[\]/);
});

test('/inventory/stock page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createStockGridColumns, type StockData \} from '\.\/stockColumns'/);
  assert.match(page, /createStockGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'availableQty'/);
});
