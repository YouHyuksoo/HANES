import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/arrival-result/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/arrival-result/arrivalResultColumns.tsx', 'utf8');

test('/material/arrival-result extracts DataGrid columns into arrivalResultColumns.tsx factory', () => {
  assert.match(columns, /export function createArrivalResultGridColumns\(/);
  assert.match(columns, /\}: CreateArrivalResultGridColumnsOptions\): ColumnDef<ArrivalResultRow>\[\]/);
});

test('/material/arrival-result page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createArrivalResultGridColumns, type ArrivalResultRow \} from "\.\/arrivalResultColumns"/);
  assert.match(page, /createArrivalResultGridColumns\(\{[\s\S]*onCancelArrival: setCancelTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "arrivalNo"/);
});
