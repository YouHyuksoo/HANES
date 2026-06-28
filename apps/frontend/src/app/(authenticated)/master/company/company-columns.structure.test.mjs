import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/company/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/company/companyColumns.tsx', 'utf8');

test('/master/company extracts DataGrid columns into companyColumns.tsx factory', () => {
  assert.match(columns, /export function createCompanyGridColumns\(/);
  assert.match(columns, /\}: CreateCompanyGridColumnsOptions\): ColumnDef<Company>\[\]/);
});

test('/master/company page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createCompanyGridColumns \} from "\.\/companyColumns"/);
  assert.match(page, /createCompanyGridColumns\(\{[\s\S]*onEditCompany: openEdit[\s\S]*onDeleteCompany: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "companyCode"/);
});
