import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/control-plan/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/control-plan/controlPlanColumns.tsx', 'utf8');

test('/quality/control-plan extracts DataGrid columns into controlPlanColumns.tsx factory', () => {
  assert.match(columns, /export function createControlPlanGridColumns\(/);
  assert.match(columns, /\}: CreateControlPlanGridColumnsOptions\): ColumnDef<ControlPlan>\[\]/);
});

test('/quality/control-plan page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createControlPlanGridColumns, ControlPlan \} from "\.\/controlPlanColumns"/);
  assert.match(page, /createControlPlanGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "planNo"/);
});
