import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/consumables/master/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/consumables/master/consumableMasterColumns.tsx', 'utf8');

test('/consumables/master extracts DataGrid columns into consumableMasterColumns.tsx factory', () => {
  assert.match(columns, /export function createConsumableMasterGridColumns\(/);
  assert.match(columns, /\}: CreateConsumableMasterGridColumnsOptions\): ColumnDef<ConsumableItem>\[\]/);
});

test('/consumables/master page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createConsumableMasterGridColumns \} from "\.\/consumableMasterColumns"/);
  assert.match(page, /createConsumableMasterGridColumns\(\{[\s\S]*onEdit:[\s\S]*onUsageMap:[\s\S]*onDelete: handleDelete[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "consumableCode"/);
});

test('/consumables/master opens usage map from an action icon, not row click', () => {
  assert.match(columns, /onUsageMap: \(item: ConsumableItem\) => void/);
  assert.match(columns, /Link2/);
  assert.match(columns, /onUsageMap\(row\.original\)/);
  assert.doesNotMatch(page, /onRowClick/);
});
