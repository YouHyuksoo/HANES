import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/customer-po-status/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/customer-po-status/shippingCustomerPoStatusColumns.tsx', 'utf8');

test('/shipping/customer-po-status extracts DataGrid columns into shippingCustomerPoStatusColumns.tsx factory', () => {
  assert.match(columns, /export function createShippingCustomerPoStatusGridColumns\(/);
  assert.match(columns, /\}: CreateShippingCustomerPoStatusGridColumnsOptions\): ColumnDef<CustomerPoStatus>\[\]/);
});

test('/shipping/customer-po-status page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShippingCustomerPoStatusGridColumns, CustomerPoStatus \} from "\.\/shippingCustomerPoStatusColumns"/);
  assert.match(page, /createShippingCustomerPoStatusGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "orderNo"/);
});
