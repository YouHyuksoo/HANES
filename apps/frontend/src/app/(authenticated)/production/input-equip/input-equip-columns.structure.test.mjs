import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/input-equip/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/input-equip/inputEquipColumns.tsx', 'utf8');

test('/production/input-equip extracts DataGrid columns into inputEquipColumns.tsx factory', () => {
  assert.match(columns, /export function createInputEquipGridColumns\(/);
  assert.match(columns, /\}: CreateInputEquipGridColumnsOptions\): ColumnDef<EquipInspect>\[\]/);
});

test('/production/input-equip page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createInputEquipGridColumns, type EquipInspect \} from '\.\/inputEquipColumns'/);
  assert.match(page, /createInputEquipGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'orderNo'/);
});
