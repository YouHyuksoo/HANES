import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/misc-receipt/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/misc-receipt/miscReceiptColumns.tsx', 'utf8');

test('/material/misc-receipt extracts DataGrid columns into miscReceiptColumns.tsx factory', () => {
  assert.match(columns, /export function createMiscReceiptGridColumns\(/);
  assert.match(columns, /\}: CreateMiscReceiptGridColumnsOptions\): ColumnDef<MiscReceiptRecord>\[\]/);
});

test('/material/misc-receipt page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createMiscReceiptGridColumns, MiscReceiptRecord \} from "\.\/miscReceiptColumns"/);
  assert.match(page, /createMiscReceiptGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transNo"/);
});
