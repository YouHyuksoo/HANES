import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/wip-material-trans/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/wip-material-trans/wipMaterialTransColumns.tsx', 'utf8');

test('/production/wip-material-trans extracts DataGrid columns into wipMaterialTransColumns.tsx factory', () => {
  assert.match(columns, /export function createWipMaterialTransGridColumns\(/);
  assert.match(columns, /\}: CreateWipMaterialTransGridColumnsOptions\): ColumnDef<WipMatTransactionRow>\[\]/);
});

test('/production/wip-material-trans page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createWipMaterialTransGridColumns, WipMatTransactionRow \} from '\.\/wipMaterialTransColumns'/);
  assert.match(page, /createWipMaterialTransGridColumns\(\{[\s\S]*t[\s\S]*getTransTypeLabel[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'createdAt'/);
});
