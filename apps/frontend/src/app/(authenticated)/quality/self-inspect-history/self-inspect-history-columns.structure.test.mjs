import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/self-inspect-history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/self-inspect-history/selfInspectHistoryColumns.tsx', 'utf8');

test('/quality/self-inspect-history extracts DataGrid columns into selfInspectHistoryColumns.tsx factories', () => {
  assert.match(columns, /export function createSelfInspectHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateSelfInspectHistoryGridColumnsOptions\): ColumnDef<HistoryRecord, unknown>\[\]/);
  assert.match(columns, /export function createSelfInspectHistoryDetailGridColumns\(/);
  assert.match(columns, /\}: CreateSelfInspectHistoryDetailGridColumnsOptions\): ColumnDef<DetailRecord, unknown>\[\]/);
});

test('/quality/self-inspect-history page consumes the extracted column factories', () => {
  assert.match(page, /import \{[\s\S]*createSelfInspectHistoryGridColumns[\s\S]*createSelfInspectHistoryDetailGridColumns[\s\S]*\} from "\.\/selfInspectHistoryColumns"/);
  assert.match(page, /createSelfInspectHistoryGridColumns\(\{ t \}\)/);
  assert.match(page, /createSelfInspectHistoryDetailGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "orderNo"/);
  assert.doesNotMatch(page, /accessorKey: "createdAt"/);
});
