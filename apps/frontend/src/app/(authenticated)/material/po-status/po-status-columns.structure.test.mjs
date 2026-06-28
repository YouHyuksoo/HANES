import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/po-status/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/po-status/poStatusColumns.tsx', 'utf8');

test('/material/po-status extracts DataGrid columns into poStatusColumns.tsx factories', () => {
  assert.match(columns, /export function createPoStatusGridColumns\(/);
  assert.match(columns, /\}: CreatePoStatusGridColumnsOptions\): ColumnDef<PoStatusRaw>\[\]/);
  assert.match(columns, /export function createPoStatusDetailGridColumns\(/);
  assert.match(columns, /\}: CreatePoStatusDetailGridColumnsOptions\): ColumnDef<PoStatusItemRaw>\[\]/);
});

test('/material/po-status page consumes the extracted column factories', () => {
  assert.match(page, /import \{[\s\S]*createPoStatusGridColumns[\s\S]*createPoStatusDetailGridColumns[\s\S]*\} from "\.\/poStatusColumns"/);
  assert.match(page, /createPoStatusGridColumns\(\{ t, poStatusMap \}\)/);
  assert.match(page, /createPoStatusDetailGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "poNo"/);
  assert.doesNotMatch(page, /accessorKey: "itemCode"/);
});
