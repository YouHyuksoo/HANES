import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/equip-inspect-item/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/equip-inspect-item/equipInspectItemColumns.tsx', 'utf8');

test('/master/equip-inspect-item extracts DataGrid columns into equipInspectItemColumns.tsx factory', () => {
  assert.match(columns, /export function createEquipInspectItemGridColumns\(/);
  assert.match(columns, /\}: CreateEquipInspectItemGridColumnsOptions\): ColumnDef<InspectItemPoolRow>\[\]/);
});

test('/master/equip-inspect-item page consumes the extracted column factory', () => {
  assert.match(page, /createEquipInspectItemGridColumns,?\s*\n?\s*}? from "\.\/equipInspectItemColumns"|import \{[\s\S]*createEquipInspectItemGridColumns[\s\S]*\} from "\.\/equipInspectItemColumns"/);
  assert.match(page, /createEquipInspectItemGridColumns\(\{[\s\S]*onEditItem: openEdit[\s\S]*onDeleteItem: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "itemCode"/);
  assert.doesNotMatch(page, /id: "actions"/);
});
