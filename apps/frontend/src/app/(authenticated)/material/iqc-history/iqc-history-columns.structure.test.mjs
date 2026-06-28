import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/iqc-history/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/iqc-history/iqcHistoryColumns.tsx', 'utf8');

test('/material/iqc-history extracts DataGrid columns into iqcHistoryColumns.tsx factory', () => {
  assert.match(columns, /export function createIqcHistoryGridColumns\(/);
  assert.match(columns, /\}: CreateIqcHistoryGridColumnsOptions\): ColumnDef<IqcHistoryItem>\[\]/);
});

test('/material/iqc-history page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createIqcHistoryGridColumns, getLotNoDisplay, type IqcHistoryItem \} from "\.\/iqcHistoryColumns"/);
  assert.match(page, /createIqcHistoryGridColumns\(\{[\s\S]*onViewDetail: setDetailRecord[\s\S]*onCancel: setCancelTarget[\s\S]*onCertUpload: handleCertUpload[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "inspectDate"/);
});
