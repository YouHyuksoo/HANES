import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/ppap/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/ppap/ppapColumns.tsx', 'utf8');

test('/quality/ppap extracts DataGrid columns into ppapColumns.tsx factory', () => {
  assert.match(columns, /export function createPpapGridColumns\(/);
  assert.match(columns, /\}: CreatePpapGridColumnsOptions\): ColumnDef<PpapSubmission>\[\]/);
});

test('/quality/ppap page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createPpapGridColumns, type PpapSubmission \} from "\.\/ppapColumns"/);
  assert.match(page, /createPpapGridColumns\(\{[\s\S]*onViewDetail: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "ppapNo"/);
});
