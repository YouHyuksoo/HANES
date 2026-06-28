import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/consumables/life/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/consumables/life/consumableLifeColumns.tsx', 'utf8');

test('/consumables/life extracts DataGrid columns into consumableLifeColumns.tsx factory', () => {
  assert.match(columns, /export function createConsumableLifeGridColumns\(/);
  assert.match(columns, /\}: CreateConsumableLifeGridColumnsOptions\): ColumnDef<LifeInstance>\[\]/);
});

test('/consumables/life page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createConsumableLifeGridColumns, type LifeInstance \} from "\.\/consumableLifeColumns"/);
  assert.match(page, /createConsumableLifeGridColumns\(\{[\s\S]*t[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "conUid"/);
});
