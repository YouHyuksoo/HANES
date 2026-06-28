import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/comm-config/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/comm-config/commConfigColumns.tsx', 'utf8');

test('/system/comm-config extracts DataGrid columns into commConfigColumns.tsx factory', () => {
  assert.match(columns, /export function createCommConfigGridColumns\(/);
  assert.match(columns, /\}: CreateCommConfigGridColumnsOptions\): ColumnDef<CommConfig>\[\]/);
});

test('/system/comm-config page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createCommConfigGridColumns \} from "\.\/commConfigColumns"/);
  assert.match(page, /createCommConfigGridColumns\(\{[\s\S]*onSerialTest: setTestTarget[\s\S]*onEditConfig: openEditModal[\s\S]*onDeleteConfig: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "configName"/);
});
