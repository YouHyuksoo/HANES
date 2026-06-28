import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/rework-history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/rework-history/reworkHistoryColumns.tsx', 'utf8');

test('/quality/rework-history extracts DataGrid columns into reworkHistoryColumns.tsx factory', () => {
  assert.match(columns, /export function createReworkHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateReworkHistoryGridColumnsOptions\): ColumnDef<ReworkOrder>\[\]/);
});

test('/quality/rework-history page consumes the extracted column factory', () => {
  assert.match(page, /import \{\s*createReworkHistoryGridColumns,[\s\S]*\} from "\.\/reworkHistoryColumns"/);
  assert.match(page, /createReworkHistoryGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "reworkNo"/);
});
