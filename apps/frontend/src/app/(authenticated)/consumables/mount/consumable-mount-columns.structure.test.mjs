import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/consumables/mount/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/consumables/mount/consumableMountColumns.tsx', 'utf8');

test('/consumables/mount extracts DataGrid columns into consumableMountColumns.tsx factory', () => {
  assert.match(columns, /export function createConsumableMountGridColumns\(/);
  assert.match(columns, /\}: CreateConsumableMountGridColumnsOptions\): ColumnDef<ConsumableItem>\[\]/);
});

test('/consumables/mount page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createConsumableMountGridColumns, type ConsumableItem \} from "\.\/consumableMountColumns"/);
  assert.match(page, /createConsumableMountGridColumns\(\{[\s\S]*onAction: openAction[\s\S]*onHistory: openHistory[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "consumableCode"/);
});
