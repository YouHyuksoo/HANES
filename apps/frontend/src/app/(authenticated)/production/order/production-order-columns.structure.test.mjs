import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/order/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/order/productionOrderColumns.tsx', 'utf8');

test('/production/order extracts DataGrid columns into productionOrderColumns.tsx factory', () => {
  assert.match(columns, /export function createProductionOrderGridColumns\(/);
  assert.match(columns, /\}: CreateProductionOrderGridColumnsOptions\): ColumnDef<JobOrderItem & \{ _depth: number \}>\[\]/);
});

test('/production/order page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductionOrderGridColumns \} from "\.\/productionOrderColumns"/);
  assert.match(page, /createProductionOrderGridColumns\(\{[\s\S]*onEdit: handleEdit[\s\S]*onDelete: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "planDate"/);
});
