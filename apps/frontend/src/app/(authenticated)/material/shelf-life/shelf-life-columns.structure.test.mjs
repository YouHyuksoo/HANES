import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/shelf-life/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/shelf-life/shelfLifeColumns.tsx', 'utf8');

test('/material/shelf-life extracts DataGrid columns into shelfLifeColumns.tsx factory', () => {
  assert.match(columns, /export function createShelfLifeGridColumns\(/);
  assert.match(columns, /\}: CreateShelfLifeGridColumnsOptions\): ColumnDef<ShelfLifeItem>\[\]/);
});

test('/material/shelf-life page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShelfLifeGridColumns, type ShelfLifeItem \} from "\.\/shelfLifeColumns"/);
  assert.match(page, /createShelfLifeGridColumns\(\{[\s\S]*onReinspect:[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "matUid"/);
});
