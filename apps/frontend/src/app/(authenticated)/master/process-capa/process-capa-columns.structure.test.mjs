import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/process-capa/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/process-capa/processCapaColumns.tsx', 'utf8');

test('/master/process-capa extracts DataGrid columns into processCapaColumns.tsx factory', () => {
  assert.match(columns, /export function createProcessCapaGridColumns\(/);
  assert.match(columns, /\}: CreateProcessCapaGridColumnsOptions\): ColumnDef<ProcessCapaItem>\[\]/);
});

test('/master/process-capa page consumes the extracted column factory', () => {
  assert.match(page, /import \{[\s\S]*createProcessCapaGridColumns[\s\S]*\} from "\.\/processCapaColumns"/);
  assert.match(page, /createProcessCapaGridColumns\(\{[\s\S]*t[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "dailyCapa"/);
});
