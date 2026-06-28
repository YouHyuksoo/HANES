import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/wip-material-stock/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/wip-material-stock/wipMaterialStockColumns.tsx', 'utf8');

test('/production/wip-material-stock extracts DataGrid columns into wipMaterialStockColumns.tsx factory', () => {
  assert.match(columns, /export function createWipMaterialStockGridColumns\(/);
  assert.match(columns, /\}: CreateWipMaterialStockGridColumnsOptions\): ColumnDef<WipMatStockRow>\[\]/);
});

test('/production/wip-material-stock page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createWipMaterialStockGridColumns, type WipMatStockRow \} from '\.\/wipMaterialStockColumns'/);
  assert.match(page, /createWipMaterialStockGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'equipCode'/);
});
