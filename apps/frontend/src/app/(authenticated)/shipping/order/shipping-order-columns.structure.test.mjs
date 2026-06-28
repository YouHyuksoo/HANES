import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/order/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/order/shippingOrderColumns.tsx', 'utf8');

test('/shipping/order extracts DataGrid columns into shippingOrderColumns.tsx factory', () => {
  assert.match(columns, /export function createShippingOrderGridColumns\(/);
  assert.match(columns, /\}: CreateShippingOrderGridColumnsOptions\): ColumnDef<ShipOrder>\[\]/);
});

test('/shipping/order page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShippingOrderGridColumns \} from "\.\/shippingOrderColumns"/);
  assert.match(page, /createShippingOrderGridColumns\(\{[\s\S]*onSelectOrder: setSelectedOrder[\s\S]*onEditOrder: openEdit[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "shipOrderNo"/);
});
