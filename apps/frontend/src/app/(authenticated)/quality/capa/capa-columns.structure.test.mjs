import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/capa/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/capa/capaColumns.tsx', 'utf8');

test('/quality/capa extracts DataGrid columns into capaColumns.tsx factory', () => {
  assert.match(columns, /export function createCapaGridColumns\(/);
  assert.match(columns, /\}: CreateCapaGridColumnsOptions\): ColumnDef<CapaRequest>\[\]/);
});

test('/quality/capa page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createCapaGridColumns, type CapaRequest \} from "\.\/capaColumns"/);
  assert.match(page, /createCapaGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "capaNo"/);
});
