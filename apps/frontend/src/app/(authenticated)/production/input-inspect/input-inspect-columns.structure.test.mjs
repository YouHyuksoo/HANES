import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/input-inspect/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/input-inspect/inputInspectColumns.tsx', 'utf8');

test('/production/input-inspect extracts DataGrid columns into inputInspectColumns.tsx factory', () => {
  assert.match(columns, /export function createInputInspectGridColumns\(/);
  assert.match(columns, /\}: CreateInputInspectGridColumnsOptions\): ColumnDef<InspectInput>\[\]/);
});

test('/production/input-inspect page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createInputInspectGridColumns, type InspectInput \} from '\.\/inputInspectColumns'/);
  assert.match(page, /createInputInspectGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: 'orderNo'/);
});
