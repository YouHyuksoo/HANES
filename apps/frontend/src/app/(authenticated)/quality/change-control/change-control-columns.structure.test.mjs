import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/change-control/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/change-control/changeControlColumns.tsx', 'utf8');

test('/quality/change-control extracts DataGrid columns into changeControlColumns.tsx factory', () => {
  assert.match(columns, /export function createChangeControlGridColumns\(/);
  assert.match(columns, /\}: CreateChangeControlGridColumnsOptions\): ColumnDef<ChangeOrder>\[\]/);
  assert.match(columns, /export interface ChangeOrder \{/);
});

test('/quality/change-control page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createChangeControlGridColumns, type ChangeOrder \} from "\.\/changeControlColumns"/);
  assert.match(page, /createChangeControlGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "changeNo"/);
});
