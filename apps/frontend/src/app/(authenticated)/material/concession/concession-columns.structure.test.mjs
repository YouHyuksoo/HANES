import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/concession/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/concession/concessionColumns.tsx', 'utf8');

test('/material/concession extracts DataGrid columns into concessionColumns.tsx factory', () => {
  assert.match(columns, /export function createConcessionGridColumns\(/);
  assert.match(columns, /\}: CreateConcessionGridColumnsOptions\): ColumnDef<ConcessionTarget>\[\]/);
});

test('/material/concession page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createConcessionGridColumns, type ConcessionTarget \} from "\.\/concessionColumns"/);
  assert.match(page, /createConcessionGridColumns\(\{[\s\S]*t[\s\S]*openModal[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "arrivalNo"/);
});
