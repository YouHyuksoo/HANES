import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/receipt-cancel/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/receipt-cancel/receiptCancelColumns.tsx', 'utf8');

test('/material/receipt-cancel extracts DataGrid columns into receiptCancelColumns.tsx factory', () => {
  assert.match(columns, /export function createReceiptCancelGridColumns\(/);
  assert.match(columns, /\}: CreateReceiptCancelGridColumnsOptions\): ColumnDef<ReceiptTransaction>\[\]/);
});

test('/material/receipt-cancel page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createReceiptCancelGridColumns, type ReceiptTransaction \} from "\.\/receiptCancelColumns"/);
  assert.match(page, /createReceiptCancelGridColumns\(\{[\s\S]*setSelectedTx[\s\S]*setReason[\s\S]*setIsModalOpen[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transNo"/);
});
