import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/defect-code/defectCodeColumns.tsx', 'utf8');

test('/quality/defect-code extracts DataGrid columns into defectCodeColumns.tsx factory', () => {
  assert.match(columns, /export function createDefectCodeGridColumns\(/);
  assert.match(columns, /\}: CreateDefectCodeGridColumnsOptions\): ColumnDef<DefectCode>\[\]/);
});

test('/quality/defect-code page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createDefectCodeGridColumns, type DefectCode \} from "\.\/defectCodeColumns"/);
  assert.match(page, /createDefectCodeGridColumns\(\{[\s\S]*t,[\s\S]*categoryLevels[\s\S]*formatDefectGrade[\s\S]*formatDefectScope[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "defectCode"/);
});
