import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/pack/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/pack/packColumns.tsx', 'utf8');

test('/shipping/pack extracts DataGrid columns into packColumns.tsx factory', () => {
  assert.match(columns, /export function createPackGridColumns\(/);
  assert.match(columns, /\}: CreatePackGridColumnsOptions\): ColumnDef<Box>\[\]/);
});

test('/shipping/pack page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createPackGridColumns, type Box \} from "\.\/packColumns"/);
  assert.match(page, /createPackGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "boxNo"/);
});
