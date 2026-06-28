import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot/lotColumns.tsx', 'utf8');

test('/material/lot extracts DataGrid columns into lotColumns.tsx factory', () => {
  assert.match(columns, /export function createLotGridColumns\(/);
  assert.match(columns, /\}: CreateLotGridColumnsOptions\): ColumnDef<MatLotItem>\[\]/);
});

test('/material/lot page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createLotGridColumns, type MatLotItem \} from "\.\/lotColumns"/);
  assert.match(page, /createLotGridColumns\(\{[\s\S]*onViewDetail:[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "matUid"/);
});
