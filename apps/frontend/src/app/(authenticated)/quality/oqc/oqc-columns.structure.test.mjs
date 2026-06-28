import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/oqc/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/oqc/oqcColumns.tsx', 'utf8');

test('/quality/oqc extracts DataGrid columns into oqcColumns.tsx factory', () => {
  assert.match(columns, /export function createOqcGridColumns\(/);
  assert.match(columns, /\}: CreateOqcGridColumnsOptions\): ColumnDef<OqcRequest>\[\]/);
});

test('/quality/oqc page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createOqcGridColumns, type OqcRequest \} from "\.\/oqcColumns"/);
  assert.match(page, /createOqcGridColumns\(\{[\s\S]*onRowAction: handleRowClick[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "requestNo"/);
});
