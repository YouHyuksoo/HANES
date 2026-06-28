import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/inspection/integrated/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/inspection/integrated/integratedColumns.tsx', 'utf8');

test('/inspection/integrated extracts DataGrid columns into integratedColumns.tsx factory', () => {
  assert.match(columns, /export function createIntegratedGridColumns\(/);
  assert.match(columns, /\}: CreateIntegratedGridColumnsOptions\): ColumnDef<InspectRecord>\[\]/);
});

test('/inspection/integrated page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createIntegratedGridColumns, type InspectRecord \} from "\.\/integratedColumns"/);
  assert.match(page, /createIntegratedGridColumns\(\{[\s\S]*t[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "inspectAt"/);
});
