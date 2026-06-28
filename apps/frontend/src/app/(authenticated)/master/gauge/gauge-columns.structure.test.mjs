import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/gauge/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/gauge/gaugeColumns.tsx', 'utf8');

test('/master/gauge extracts DataGrid columns into gaugeColumns.tsx factory', () => {
  assert.match(columns, /export function createGaugeGridColumns\(/);
  assert.match(columns, /\}: CreateGaugeGridColumnsOptions\): ColumnDef<Gauge>\[\]/);
});

test('/master/gauge page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createGaugeGridColumns, type Gauge \} from "\.\/gaugeColumns"/);
  assert.match(page, /createGaugeGridColumns\(\{[\s\S]*onEditGauge:[\s\S]*onDeleteGauge: setDeleteTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "gaugeCode"/);
});
