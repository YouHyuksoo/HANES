import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/product-trans/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/product-trans/productTransColumns.tsx', 'utf8');

test('/production/product-trans extracts DataGrid columns into productTransColumns.tsx factory', () => {
  assert.match(columns, /export function createProductTransGridColumns\(/);
  assert.match(columns, /\}: CreateProductTransGridColumnsOptions\): ColumnDef<ProductTransactionRow>\[\]/);
});

test('/production/product-trans page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createProductTransGridColumns, ProductTransactionRow \} from '\.\/productTransColumns'/);
  assert.match(page, /createProductTransGridColumns\(\{[\s\S]*t[\s\S]*getTransTypeLabel[\s\S]*getItemTypeLabel[\s\S]*getQualityLabel[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'transDate'/);
});

test('/production/product-trans page calls the product transaction ledger API and unwraps the standard envelope', () => {
  assert.match(page, /api\.get\('\/inventory\/product\/transactions', \{ params \}\)/);
  assert.match(page, /res\.data\?\.data \?\? \[\]/);
});

test('/production/product-trans filters item code via the shared PartSearchModal, not a dropdown', () => {
  assert.match(page, /import PartSearchModal, \{ type PartItem \} from '@\/components\/shared\/PartSearchModal'/);
  assert.match(page, /<PartSearchModal[\s\S]*onSelect=\{handleSelectPart\}/);
  assert.doesNotMatch(page, /PartSelect\b/);
});
