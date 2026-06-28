import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/issue-cancel/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/issue-cancel/productIssueCancelColumns.tsx', 'utf8');

test('/product/issue-cancel extracts DataGrid columns into productIssueCancelColumns.tsx factory', () => {
  assert.match(columns, /export function createProductIssueCancelGridColumns\(/);
  assert.match(columns, /\}: CreateProductIssueCancelGridColumnsOptions\): ColumnDef<ProductIssueTx>\[\]/);
});

test('/product/issue-cancel page consumes the extracted column factory', () => {
  assert.match(page, /import \{\s*createProductIssueCancelGridColumns,[\s\S]*type ProductIssueTx,[\s\S]*\} from "\.\/productIssueCancelColumns"/);
  assert.match(page, /createProductIssueCancelGridColumns\(\{[\s\S]*onCancelTx:[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transNo"/);
});
