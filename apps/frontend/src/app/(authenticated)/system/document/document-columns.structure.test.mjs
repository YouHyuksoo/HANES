import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/document/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/document/documentColumns.tsx', 'utf8');

test('/system/document extracts DataGrid columns into documentColumns.tsx factory', () => {
  assert.match(columns, /export function createDocumentGridColumns\(/);
  assert.match(columns, /\}: CreateDocumentGridColumnsOptions\): ColumnDef<Document>\[\]/);
});

test('/system/document page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createDocumentGridColumns[\s\S]*\} from "\.\/documentColumns"/);
  assert.match(page, /createDocumentGridColumns\(\{[\s\S]*onEditDocument: handleRowClick[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "docNo"/);
});
