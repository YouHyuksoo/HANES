import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/shelf-life-reinspect/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/shelf-life-reinspect/shelfLifeReinspectColumns.tsx', 'utf8');

test('/material/shelf-life-reinspect extracts DataGrid columns into shelfLifeReinspectColumns.tsx factory', () => {
  assert.match(columns, /export function createShelfLifeReinspectGridColumns\(/);
  assert.match(columns, /\}: CreateShelfLifeReinspectGridColumnsOptions\): ColumnDef<ShelfLifeItem>\[\]/);
});

test('/material/shelf-life-reinspect page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShelfLifeReinspectGridColumns, type ShelfLifeItem \} from "\.\/shelfLifeReinspectColumns"/);
  assert.match(page, /createShelfLifeReinspectGridColumns\(\{[\s\S]*onInspect: openModal[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "matUid"/);
});
