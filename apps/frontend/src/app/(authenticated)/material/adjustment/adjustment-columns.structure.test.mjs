import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/adjustment/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/adjustment/adjustmentColumns.tsx', 'utf8');

test('/material/adjustment extracts DataGrid columns into adjustmentColumns.tsx factory', () => {
  assert.match(columns, /export function createAdjustmentGridColumns\(/);
  assert.match(columns, /\}: CreateAdjustmentGridColumnsOptions\): ColumnDef<AdjustmentRecord>\[\]/);
});

test('/material/adjustment page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createAdjustmentGridColumns, type AdjustmentRecord \} from "\.\/adjustmentColumns"/);
  assert.match(page, /createAdjustmentGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "diffQty"/);
});

test('/material/adjustment page does not render top summary info cards', () => {
  assert.doesNotMatch(page, /StatCard/);
  assert.doesNotMatch(page, /const\s+stats\s*=/);
  assert.doesNotMatch(page, /material\.adjustment\.stats\./);
});
