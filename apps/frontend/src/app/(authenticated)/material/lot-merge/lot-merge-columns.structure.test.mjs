import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot-merge/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot-merge/lotMergeColumns.tsx', 'utf8');

test('/material/lot-merge extracts DataGrid columns into lotMergeColumns.tsx factory', () => {
  assert.match(columns, /export function createLotMergeGridColumns\(/);
  assert.match(columns, /\}: CreateLotMergeGridColumnsOptions\): ColumnDef<MergeableLot>\[\]/);
});

test('/material/lot-merge page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createLotMergeGridColumns, type MergeableLot \} from "\.\/lotMergeColumns"/);
  assert.match(page, /createLotMergeGridColumns\(\{[\s\S]*t[\s\S]*scanned[\s\S]*addByBarcode[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "matUid"/);
});
