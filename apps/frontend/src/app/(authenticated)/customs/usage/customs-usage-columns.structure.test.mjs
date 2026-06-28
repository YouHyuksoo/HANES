import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/customs/usage/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/customs/usage/customsUsageColumns.tsx', 'utf8');

test('/customs/usage extracts DataGrid columns into customsUsageColumns.tsx factory', () => {
  assert.match(columns, /export function createCustomsUsageGridColumns\(/);
  assert.match(columns, /\}: CreateCustomsUsageGridColumnsOptions\): ColumnDef<UsageReport>\[\]/);
});

test('/customs/usage page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createCustomsUsageGridColumns, type UsageReport \} from "\.\/customsUsageColumns"/);
  assert.match(page, /createCustomsUsageGridColumns\(\{[\s\S]*onReport: handleReport[\s\S]*onConfirm: handleConfirm[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "reportNo"/);
});
