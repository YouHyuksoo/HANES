import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/shelf-life-history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/shelf-life-history/shelfLifeHistoryColumns.tsx', 'utf8');

test('/material/shelf-life-history extracts DataGrid columns into shelfLifeHistoryColumns.tsx factory', () => {
  assert.match(columns, /export function createShelfLifeHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateShelfLifeHistoryGridColumnsOptions\): ColumnDef<ReinspectHistoryItem>\[\]/);
});

test('/material/shelf-life-history page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShelfLifeHistoryGridColumns, type ReinspectHistoryItem \} from "\.\/shelfLifeHistoryColumns"/);
  assert.match(page, /createShelfLifeHistoryGridColumns\(\{[\s\S]*onViewDetail: setDetailRecord[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "inspectDate"/);
});

test('/material/shelf-life-history always sends an inspection date range (default today) and server filters', () => {
  assert.doesNotMatch(page, /limit:\s*"2000"/);
  assert.match(page, /getTodayLocal\(\)/);
  assert.doesNotMatch(page, /toISOString\(\)\.slice\(0,\s*10\)/);
  assert.match(page, /import DateRangeFilter from "@\/components\/shared\/DateRangeFilter"/);
  assert.match(page, /params\.fromDate = fromDate/);
  assert.match(page, /params\.toDate = toDate/);
  assert.match(page, /params\.itemCode = itemFilter/);
  assert.match(page, /params\.search = searchText/);
  assert.doesNotMatch(page, /const visibleData/);
  assert.match(page, /<ServerPager /);
});
