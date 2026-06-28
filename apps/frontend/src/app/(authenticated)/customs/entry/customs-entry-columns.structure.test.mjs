import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/customs/entry/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/customs/entry/customsEntryColumns.tsx', 'utf8');

test('/customs/entry extracts DataGrid columns into customsEntryColumns.tsx factory', () => {
  assert.match(columns, /export function createCustomsEntryGridColumns\(/);
  assert.match(columns, /\}: CreateCustomsEntryGridColumnsOptions\): ColumnDef<CustomsEntry>\[\]/);
});

test('/customs/entry page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createCustomsEntryGridColumns, type CustomsEntry \} from "\.\/customsEntryColumns"/);
  assert.match(page, /createCustomsEntryGridColumns\(\{[\s\S]*onEditEntry: openEdit[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "entryNo"/);
});
