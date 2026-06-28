import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/arrival-stock/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/arrival-stock/arrivalStockColumns.tsx', 'utf8');

test('/material/arrival-stock extracts DataGrid columns into arrivalStockColumns.tsx factory', () => {
  assert.match(columns, /export function createArrivalStockGridColumns\(/);
  assert.match(columns, /\}: CreateArrivalStockGridColumnsOptions\): ColumnDef<ArrivalStockItem>\[\]/);
});

test('/material/arrival-stock page consumes the extracted column factory', () => {
  assert.match(page, /import \{\s*createArrivalStockGridColumns[\s\S]*\} from "\.\/arrivalStockColumns"/);
  assert.match(page, /createArrivalStockGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "arrivalNo"/);
});
