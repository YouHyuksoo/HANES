import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/worker/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/worker/workerColumns.tsx', 'utf8');

test('/master/worker extracts DataGrid columns into workerColumns.tsx factory', () => {
  assert.match(columns, /export function createWorkerGridColumns\(/);
  assert.match(columns, /\}: CreateWorkerGridColumnsOptions\): ColumnDef<Worker>\[\]/);
});

test('/master/worker page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createWorkerGridColumns \} from "\.\/workerColumns"/);
  assert.match(page, /createWorkerGridColumns\(\{[\s\S]*onEditWorker: openEdit[\s\S]*onDeleteWorker: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "workerCode"/);
});
