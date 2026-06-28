import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/product-physical-inv-history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inventory/product-physical-inv-history/productPhysicalInvHistoryColumns.tsx', 'utf8');

test('/inventory/product-physical-inv-history extracts DataGrid columns into productPhysicalInvHistoryColumns.tsx factory', () => {
  assert.match(columns, /export function createProductPhysicalInvHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateProductPhysicalInvHistoryGridColumnsOptions\): ColumnDef<InvHistoryItem>\[\]/);
});

test('/inventory/product-physical-inv-history page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductPhysicalInvHistoryGridColumns \} from "\.\/productPhysicalInvHistoryColumns"/);
  assert.match(page, /createProductPhysicalInvHistoryGridColumns\(\{[\s\S]*t[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "diffQty"/);
});
