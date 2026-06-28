import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/issue/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/product/issue/productIssueColumns.tsx', 'utf8');

test('/product/issue extracts DataGrid columns into productIssueColumns.tsx factory', () => {
  assert.match(columns, /export function createProductIssueGridColumns\(/);
  assert.match(columns, /\}: CreateProductIssueGridColumnsOptions\): ColumnDef<ProductIssueTx>\[\]/);
});

test('/product/issue page consumes the extracted column factory', () => {
  assert.match(page, /import \{ ProductIssueTx, createProductIssueGridColumns \} from "\.\/productIssueColumns"/);
  assert.match(page, /createProductIssueGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transNo"/);
});
