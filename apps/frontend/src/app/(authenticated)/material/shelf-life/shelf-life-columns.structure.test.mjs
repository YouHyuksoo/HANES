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

test('/material/shelf-life queries the server with page/limit and server-side filters (no bulk fetch)', () => {
  assert.doesNotMatch(page, /limit:\s*"5000"/);
  assert.match(page, /page:\s*String\(page\)/);
  assert.match(page, /params\.expiryStatus = expiryFilter/);
  assert.match(page, /params\.itemCode = itemFilter/);
  assert.match(page, /params\.search = searchText/);
  // 클라이언트 전량 필터(visibleData) 금지
  assert.doesNotMatch(page, /const visibleData/);
  assert.match(page, /<ServerPager /);
});
