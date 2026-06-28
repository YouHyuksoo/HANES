import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-physical-inv-apply/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-physical-inv-apply/materialPhysicalInvApplyColumns.tsx', 'utf8');

test('/inventory/material-physical-inv-apply extracts DataGrid columns into materialPhysicalInvApplyColumns.tsx factory', () => {
  assert.match(columns, /export function createMaterialPhysicalInvApplyGridColumns\(/);
  assert.match(columns, /\}: CreateMaterialPhysicalInvApplyGridColumnsOptions\): ColumnDef<StockForCount>\[\]/);
});

test('/inventory/material-physical-inv-apply page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createMaterialPhysicalInvApplyGridColumns \} from "\.\/materialPhysicalInvApplyColumns"/);
  assert.match(page, /createMaterialPhysicalInvApplyGridColumns\(\{[\s\S]*t[\s\S]*updateCountedQty[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "warehouseName"/);
});
