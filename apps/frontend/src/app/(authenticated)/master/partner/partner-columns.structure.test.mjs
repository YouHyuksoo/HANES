import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/partner/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/partner/partnerColumns.tsx', 'utf8');

test('/master/partner extracts DataGrid columns into partnerColumns.tsx factory', () => {
  assert.match(columns, /export function createPartnerGridColumns\(/);
  assert.match(columns, /\}: CreatePartnerGridColumnsOptions\): ColumnDef<Partner>\[\]/);
});

test('/master/partner page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createPartnerGridColumns \} from "\.\/partnerColumns"/);
  assert.match(page, /createPartnerGridColumns\(\{[\s\S]*onEditPartner: openEditPanel[\s\S]*onDeletePartner: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "partnerCode"/);
});
