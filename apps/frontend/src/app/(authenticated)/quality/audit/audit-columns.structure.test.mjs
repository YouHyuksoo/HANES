import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/audit/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/audit/auditColumns.tsx', 'utf8');

test('/quality/audit extracts DataGrid columns into auditColumns.tsx factory', () => {
  assert.match(columns, /export function createAuditGridColumns\(/);
  assert.match(columns, /\}: CreateAuditGridColumnsOptions\): ColumnDef<Audit>\[\]/);
});

test('/quality/audit page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createAuditGridColumns, Audit \} from "\.\/auditColumns"/);
  assert.match(page, /createAuditGridColumns\(\{[\s\S]*onSelect: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "auditNo"/);
});
