import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/sample-inspect/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/production/sample-inspect/sampleInspectColumns.tsx', 'utf8');

test('/production/sample-inspect extracts DataGrid columns into sampleInspectColumns.tsx factory', () => {
  assert.match(columns, /export function createSampleInspectGridColumns\(/);
  assert.match(columns, /\}: CreateSampleInspectGridColumnsOptions\): ColumnDef<SampleInspectRow>\[\]/);
});

test('/production/sample-inspect page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createSampleInspectGridColumns, type SampleInspectRow \} from "\.\/sampleInspectColumns"/);
  assert.match(page, /createSampleInspectGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "inspectDate"/);
});
