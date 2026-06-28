import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/spc/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/spc/spcColumns.tsx', 'utf8');

test('/quality/spc extracts DataGrid columns into spcColumns.tsx factory', () => {
  assert.match(columns, /export function createSpcGridColumns\(/);
  assert.match(columns, /\}: CreateSpcGridColumnsOptions\): ColumnDef<SpcChart>\[\]/);
});

test('/quality/spc page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createSpcGridColumns, type SpcChart \} from "\.\/spcColumns"/);
  assert.match(page, /createSpcGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "chartNo"/);
});
