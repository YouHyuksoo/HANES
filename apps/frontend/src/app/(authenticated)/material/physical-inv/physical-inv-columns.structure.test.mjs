import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/physical-inv/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/physical-inv/physicalInvColumns.tsx', 'utf8');

test('/material/physical-inv extracts DataGrid columns into physicalInvColumns.tsx factory', () => {
  assert.match(columns, /export function createPhysicalInvGridColumns\(/);
  assert.match(columns, /\}: CreatePhysicalInvGridColumnsOptions\): ColumnDef<StockForCount>\[\]/);
});

test('/material/physical-inv page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createPhysicalInvGridColumns, StockForCount \} from "\.\/physicalInvColumns"/);
  assert.match(page, /createPhysicalInvGridColumns\(\{[\s\S]*t,[\s\S]*updateCountedQty[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "warehouseCode"/);
});
