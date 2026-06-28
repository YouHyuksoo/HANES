import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/work-instruction/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/work-instruction/workInstructionColumns.tsx', 'utf8');

test('/master/work-instruction extracts DataGrid columns into workInstructionColumns.tsx factory', () => {
  assert.match(columns, /export function createWorkInstructionGridColumns\(/);
  assert.match(columns, /\}: CreateWorkInstructionGridColumnsOptions\): ColumnDef<WorkInstruction>\[\]/);
});

test('/master/work-instruction page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createWorkInstructionGridColumns \} from "\.\/workInstructionColumns"/);
  assert.match(page, /createWorkInstructionGridColumns\(\{[\s\S]*onEditWorkInstruction: handleEditClick[\s\S]*onDeleteWorkInstruction: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "itemCode"/);
});
