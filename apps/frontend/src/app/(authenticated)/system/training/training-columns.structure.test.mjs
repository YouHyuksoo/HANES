import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/training/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/training/trainingColumns.tsx', 'utf8');

test('/system/training extracts DataGrid columns into trainingColumns.tsx factory', () => {
  assert.match(columns, /export function createTrainingGridColumns\(/);
  assert.match(columns, /\}: CreateTrainingGridColumnsOptions\): ColumnDef<TrainingPlan>\[\]/);
});

test('/system/training page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createTrainingGridColumns, type TrainingPlan \} from "\.\/trainingColumns"/);
  assert.match(page, /createTrainingGridColumns\(\{[\s\S]*onSelectRow: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "planNo"/);
});
