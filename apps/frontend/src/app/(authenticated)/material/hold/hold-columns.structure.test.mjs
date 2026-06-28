import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/hold/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/hold/holdColumns.tsx', 'utf8');

test('/material/hold extracts DataGrid columns into holdColumns.tsx factory', () => {
  assert.match(columns, /export function createHoldGridColumns\(/);
  assert.match(columns, /\}: CreateHoldGridColumnsOptions\): ColumnDef<HoldLot>\[\]/);
});

test('/material/hold page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createHoldGridColumns, formatQty, type HoldLot \} from "\.\/holdColumns"/);
  assert.match(page, /createHoldGridColumns\(\{[\s\S]*setSelectedLot[\s\S]*setActionType[\s\S]*setReason[\s\S]*setIsModalOpen[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "matUid"/);
});
