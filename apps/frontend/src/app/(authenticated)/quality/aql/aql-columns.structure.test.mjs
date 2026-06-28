import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/aql/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/aql/aqlColumns.tsx', 'utf8');

test('/quality/aql extracts DataGrid columns into aqlColumns.tsx factories', () => {
  assert.match(columns, /export function createAqlGridColumns\(/);
  assert.match(columns, /\}: CreateAqlGridColumnsOptions\): ColumnDef<AqlStandard>\[\]/);
  assert.match(columns, /export function createAqlPolicyGridColumns\(/);
  assert.match(columns, /\}: CreateAqlPolicyGridColumnsOptions\): ColumnDef<IqcAqlPolicy>\[\]/);
});

test('/quality/aql page consumes the extracted column factories', () => {
  assert.match(page, /createAqlGridColumns,\s*\n\s*createAqlPolicyGridColumns/);
  assert.match(page, /from "\.\/aqlColumns"/);
  assert.match(page, /createAqlGridColumns\(\{ t \}\)/);
  assert.match(page, /createAqlPolicyGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "aqlCode"/);
  assert.doesNotMatch(page, /accessorKey: "policyCode"/);
});
