import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/rework/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/rework/reworkColumns.tsx', 'utf8');

test('/quality/rework extracts DataGrid columns into reworkColumns.tsx factory', () => {
  assert.match(columns, /export function createReworkGridColumns\(/);
  assert.match(columns, /\}: CreateReworkGridColumnsOptions\): ColumnDef<ReworkOrder>\[\]/);
});

test('/quality/rework page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createReworkGridColumns, type ReworkOrder \} from "\.\/reworkColumns"/);
  assert.match(page, /createReworkGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "reworkNo"/);
});
