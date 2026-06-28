import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/customer-po/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/customer-po/shippingCustomerPoColumns.tsx', 'utf8');

test('/shipping/customer-po extracts DataGrid columns into shippingCustomerPoColumns.tsx factory', () => {
  assert.match(columns, /export function createShippingCustomerPoGridColumns\(/);
  assert.match(columns, /\}: CreateShippingCustomerPoGridColumnsOptions\): ColumnDef<CustomerOrder>\[\]/);
});

test('/shipping/customer-po page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShippingCustomerPoGridColumns \} from "\.\/shippingCustomerPoColumns"/);
  assert.match(page, /createShippingCustomerPoGridColumns\(\{[\s\S]*onEdit:[\s\S]*onDelete:[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "orderNo"/);
});
