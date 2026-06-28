import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/stock/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/stock/materialStockColumns.tsx', 'utf8');

test('/material/stock extracts DataGrid columns into materialStockColumns.tsx factory', () => {
  assert.match(columns, /export function createMaterialStockGridColumns\(/);
  assert.match(columns, /\}: CreateMaterialStockGridColumnsOptions\): ColumnDef<StockItem>\[\]/);
});

test('/material/stock page consumes the extracted column factory', () => {
  assert.match(page, /import \{\s*createMaterialStockGridColumns,[\s\S]*\} from "\.\/materialStockColumns"/);
  assert.match(page, /createMaterialStockGridColumns\(\{[\s\S]*stockLevelLabels[\s\S]*shelfLifeLabels[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "itemCode"/);
});
