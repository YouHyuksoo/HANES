import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/history/shippingHistoryColumns.tsx', 'utf8');

test('/shipping/history extracts DataGrid columns into shippingHistoryColumns.tsx factory', () => {
  assert.match(columns, /export function createShippingHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateShippingHistoryGridColumnsOptions\): ColumnDef<ShipHistory>\[\]/);
});

test('/shipping/history page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShippingHistoryGridColumns, type ShipHistory \} from "\.\/shippingHistoryColumns"/);
  assert.match(page, /createShippingHistoryGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "shipOrderNo"/);
});
