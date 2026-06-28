import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot-split/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/lot-split/lotSplitColumns.tsx', 'utf8');

test('/material/lot-split extracts DataGrid columns into lotSplitColumns.tsx factory', () => {
  assert.match(columns, /export function createLotSplitGridColumns\(/);
  assert.match(columns, /\}: CreateLotSplitGridColumnsOptions\): ColumnDef<SplittableLot>\[\]/);
});

test('/material/lot-split page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createLotSplitGridColumns, type SplittableLot \} from "\.\/lotSplitColumns"/);
  assert.match(page, /createLotSplitGridColumns\(\{[\s\S]*onSplit: handleOpenSplit[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "matUid"/);
});
