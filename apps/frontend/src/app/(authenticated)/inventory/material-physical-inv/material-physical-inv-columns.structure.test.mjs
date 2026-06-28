import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-physical-inv/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-physical-inv/materialPhysicalInvColumns.tsx', 'utf8');

test('/inventory/material-physical-inv extracts DataGrid columns into materialPhysicalInvColumns.tsx factory', () => {
  assert.match(columns, /export function createMaterialPhysicalInvGridColumns\(/);
  assert.match(columns, /\}: CreateMaterialPhysicalInvGridColumnsOptions\): ColumnDef<StockForCount>\[\]/);
});

test('/inventory/material-physical-inv page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createMaterialPhysicalInvGridColumns \} from "\.\/materialPhysicalInvColumns"/);
  assert.match(page, /createMaterialPhysicalInvGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "warehouseName"/);
});
