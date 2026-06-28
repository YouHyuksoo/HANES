import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/oqc-history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/oqc-history/oqcHistoryColumns.tsx', 'utf8');

test('/quality/oqc-history extracts DataGrid columns into oqcHistoryColumns.tsx factory', () => {
  assert.match(columns, /export function createOqcHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateOqcHistoryGridColumnsOptions\): ColumnDef<OqcHistoryItem>\[\]/);
});

test('/quality/oqc-history page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createOqcHistoryGridColumns, type OqcHistoryItem \} from "\.\/oqcHistoryColumns"/);
  assert.match(page, /createOqcHistoryGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "requestNo"/);
});
