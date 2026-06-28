import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/specification-setup/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/specification-setup/specificationSetupColumns.tsx', 'utf8');

test('/production/specification-setup extracts DataGrid columns into specificationSetupColumns.tsx factory', () => {
  assert.match(columns, /export function createSpecificationSetupGridColumns\(/);
  assert.match(columns, /\}: CreateSpecificationSetupGridColumnsOptions\): ColumnDef<HarnessDrawing>\[\]/);
});

test('/production/specification-setup page consumes the extracted column factory', () => {
  assert.match(page, /import \{[\s\S]*createSpecificationSetupGridColumns[\s\S]*\} from "\.\/specificationSetupColumns"/);
  assert.match(page, /createSpecificationSetupGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "drawingNo"/);
});
