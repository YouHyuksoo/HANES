import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/repair/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/repair/repairColumns.tsx', 'utf8');

test('/production/repair extracts DataGrid columns into repairColumns.tsx factory', () => {
  assert.match(columns, /export function createRepairGridColumns\(/);
  assert.match(columns, /\}: CreateRepairGridColumnsOptions\): ColumnDef<RepairItem>\[\]/);
});

test('/production/repair page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createRepairGridColumns \} from "\.\/repairColumns"/);
  assert.match(page, /createRepairGridColumns\(\{[\s\S]*onDeleteRepair: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "repairDate"/);
});
