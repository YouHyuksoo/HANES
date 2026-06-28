import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/users/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/system/users/usersColumns.tsx', 'utf8');

test('/system/users extracts DataGrid columns into usersColumns.tsx factory', () => {
  assert.match(columns, /export function createUsersGridColumns\(/);
  assert.match(columns, /\}: CreateUsersGridColumnsOptions\): ColumnDef<User>\[\]/);
});

test('/system/users page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createUsersGridColumns, type User \} from "\.\/usersColumns"/);
  assert.match(page, /createUsersGridColumns\(\{[\s\S]*onEditUser:[\s\S]*onDeleteUser:[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "email"/);
});
