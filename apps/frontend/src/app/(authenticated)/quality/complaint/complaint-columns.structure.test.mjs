import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/complaint/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/complaint/complaintColumns.tsx', 'utf8');

test('/quality/complaint extracts DataGrid columns into complaintColumns.tsx factory', () => {
  assert.match(columns, /export function createComplaintGridColumns\(/);
  assert.match(columns, /\}: CreateComplaintGridColumnsOptions\): ColumnDef<Complaint>\[\]/);
});

test('/quality/complaint page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createComplaintGridColumns, type Complaint \} from "\.\/complaintColumns"/);
  assert.match(page, /createComplaintGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "complaintNo"/);
});
