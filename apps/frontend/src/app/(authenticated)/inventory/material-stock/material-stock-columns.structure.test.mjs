import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-stock/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-stock/materialStockColumns.tsx', 'utf8');

test('/inventory/material-stock extracts DataGrid columns into materialStockColumns.tsx factories', () => {
  assert.match(columns, /export function createMaterialStockGridColumns\(/);
  assert.match(columns, /\}: CreateMaterialStockGridColumnsOptions\): ColumnDef<StockItem>\[\]/);
  assert.match(columns, /export function createMaterialStockGroupGridColumns\(/);
  assert.match(columns, /\}: CreateMaterialStockGroupGridColumnsOptions\): ColumnDef<GroupItem>\[\]/);
});

test('/inventory/material-stock page consumes the extracted column factories', () => {
  assert.match(page, /import \{\s*createMaterialStockGridColumns,\s*createMaterialStockGroupGridColumns,\s*\} from "\.\/materialStockColumns"/);
  assert.match(page, /createMaterialStockGridColumns\(\{[\s\S]*stockLevelLabels[\s\S]*shelfLifeLabels[\s\S]*\}\)/);
  assert.match(page, /createMaterialStockGroupGridColumns\(\{[\s\S]*stockLevelLabels[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "warehouseName"/);
  assert.doesNotMatch(page, /header: t\("material\.stock\.groupColumns\.totalQty"\)/);
});
