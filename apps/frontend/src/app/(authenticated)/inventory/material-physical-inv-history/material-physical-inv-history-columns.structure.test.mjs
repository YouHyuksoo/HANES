import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-physical-inv-history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/material-physical-inv-history/materialPhysicalInvHistoryColumns.tsx', 'utf8');

test('/inventory/material-physical-inv-history extracts DataGrid columns into materialPhysicalInvHistoryColumns.tsx factory', () => {
  assert.match(columns, /export function createMaterialPhysicalInvHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateMaterialPhysicalInvHistoryGridColumnsOptions\): ColumnDef<InvHistoryItem>\[\]/);
});

test('/inventory/material-physical-inv-history page consumes the extracted column factory', () => {
  assert.match(page, /import \{[\s\S]*createMaterialPhysicalInvHistoryGridColumns[\s\S]*\} from "\.\/materialPhysicalInvHistoryColumns"/);
  assert.match(page, /createMaterialPhysicalInvHistoryGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "diffQty"/);
});
