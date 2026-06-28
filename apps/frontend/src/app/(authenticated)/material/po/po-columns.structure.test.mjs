import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/po/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/po/poColumns.tsx', 'utf8');

test('/material/po extracts DataGrid columns into poColumns.tsx factory', () => {
  assert.match(columns, /export function createPoGridColumns\(/);
  assert.match(columns, /\}: CreatePoGridColumnsOptions\): ColumnDef<PurchaseOrder>\[\]/);
});

test('/material/po page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createPoGridColumns \} from "\.\/poColumns"/);
  assert.match(page, /createPoGridColumns\(\{[\s\S]*onEditPo: openEdit[\s\S]*onDeletePo: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "poNo"/);
});
