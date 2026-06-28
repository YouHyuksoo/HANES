import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/confirm/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/confirm/shipConfirmColumns.tsx', 'utf8');

test('/shipping/confirm extracts DataGrid columns into shipConfirmColumns.tsx factory', () => {
  assert.match(columns, /export function createShipConfirmGridColumns\(/);
  assert.match(columns, /\}: CreateShipConfirmGridColumnsOptions\): ColumnDef<CandidateBox>\[\]/);
});

test('/shipping/confirm page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createShipConfirmGridColumns, type CandidateBox \} from "\.\/shipConfirmColumns"/);
  assert.match(page, /createShipConfirmGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "boxNo"/);
});
