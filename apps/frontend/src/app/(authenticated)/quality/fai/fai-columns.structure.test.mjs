import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/fai/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/fai/faiColumns.tsx', 'utf8');

test('/quality/fai extracts DataGrid columns into faiColumns.tsx factory', () => {
  assert.match(columns, /export function createFaiGridColumns\(/);
  assert.match(columns, /\}: CreateFaiGridColumnsOptions\): ColumnDef<FaiRequest>\[\]/);
});

test('/quality/fai page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createFaiGridColumns, type FaiRequest \} from "\.\/faiColumns"/);
  assert.match(page, /createFaiGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "faiNo"/);
});
