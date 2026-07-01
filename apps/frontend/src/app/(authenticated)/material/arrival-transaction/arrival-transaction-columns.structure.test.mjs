import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/arrival-transaction/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/arrival-transaction/arrivalTransactionColumns.tsx', 'utf8');

test('/material/arrival-transaction extracts DataGrid columns into arrivalTransactionColumns.tsx factory', () => {
  assert.match(columns, /export function createArrivalTransactionGridColumns\(/);
  assert.match(columns, /\}: CreateArrivalTransactionGridColumnsOptions\): ColumnDef<ArrivalTransactionRow>\[\]/);
});

test('/material/arrival-transaction page consumes the extracted column factory', () => {
  assert.match(page, /import \{\s*createArrivalTransactionGridColumns,[\s\S]*\} from "\.\/arrivalTransactionColumns"/);
  assert.match(page, /createArrivalTransactionGridColumns\(\{[\s\S]*t[\s\S]*getTransTypeLabel[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transDate"/);
});

test('/material/arrival-transaction defaults date range to today instead of a fixed or month-back start date', () => {
  assert.doesNotMatch(page, /getOneMonthAgo/);
  assert.match(page, /fromDate:\s*getToday\(\)/);
  assert.match(page, /toDate:\s*getToday\(\)/);
});
