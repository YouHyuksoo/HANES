import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/pallet/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/pallet/palletColumns.tsx', 'utf8');

test('/shipping/pallet extracts DataGrid columns into palletColumns.tsx factory', () => {
  assert.match(columns, /export function createPalletGridColumns\(/);
  assert.match(columns, /\}: CreatePalletGridColumnsOptions\): ColumnDef<Pallet>\[\]/);
  assert.match(columns, /export interface Pallet \{/);
});

test('/shipping/pallet page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createPalletGridColumns \} from "\.\/palletColumns"/);
  assert.match(page, /createPalletGridColumns\(\{[\s\S]*handleClosePallet[\s\S]*setDeletePalletTarget[\s\S]*\}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "palletNo"/);
});
