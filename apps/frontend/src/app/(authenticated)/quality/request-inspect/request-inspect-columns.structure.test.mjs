import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/request-inspect/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/request-inspect/requestInspectColumns.tsx', 'utf8');

test('/quality/request-inspect extracts DataGrid columns into requestInspectColumns.tsx factory', () => {
  assert.match(columns, /export function createRequestInspectGridColumns\(/);
  assert.match(columns, /\}: CreateRequestInspectGridColumnsOptions\): ColumnDef<DelegateItem, unknown>\[\]/);
});

test('/quality/request-inspect page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createRequestInspectGridColumns, type DelegateItem \} from "\.\/requestInspectColumns"/);
  assert.match(page, /createRequestInspectGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "orderNo"/);
});
