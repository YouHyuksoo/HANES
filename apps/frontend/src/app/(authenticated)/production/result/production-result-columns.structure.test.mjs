import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/result/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/result/productionResultColumns.tsx', 'utf8');

test('/production/result extracts DataGrid columns into productionResultColumns.tsx factory', () => {
  assert.match(columns, /export function createProductionResultGridColumns\(/);
  assert.match(columns, /\}: CreateProductionResultGridColumnsOptions\): ColumnDef<ProdResult>\[\]/);
});

test('/production/result page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductionResultGridColumns, ProdResult \} from "\.\/productionResultColumns"|import \{ createProductionResultGridColumns, ProdResult \} from '\.\/productionResultColumns'/);
  assert.match(page, /createProductionResultGridColumns\(\{[\s\S]*onEditResult: openEdit[\s\S]*onDeleteResult: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'resultNo'/);
});
