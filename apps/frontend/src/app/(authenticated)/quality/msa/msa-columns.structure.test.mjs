import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/msa/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/quality/msa/msaColumns.tsx', 'utf8');

test('/quality/msa extracts DataGrid columns into msaColumns.tsx factory', () => {
  assert.match(columns, /export function createMsaGridColumns\(/);
  assert.match(columns, /\}: CreateMsaGridColumnsOptions\): ColumnDef<Gauge>\[\]/);
});

test('/quality/msa page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createMsaGridColumns, type Gauge \} from "\.\/msaColumns"/);
  assert.match(page, /createMsaGridColumns\(\{[\s\S]*onSelectGauge: setSelectedRow[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "gaugeCode"/);
});
