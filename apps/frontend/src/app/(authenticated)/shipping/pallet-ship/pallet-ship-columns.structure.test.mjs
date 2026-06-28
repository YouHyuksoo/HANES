import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/pallet-ship/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/shipping/pallet-ship/palletShipColumns.tsx', 'utf8');

test('/shipping/pallet-ship extracts DataGrid columns into palletShipColumns.tsx factory', () => {
  assert.match(columns, /export function createPalletShipGridColumns\(/);
  assert.match(columns, /\): ColumnDef<OrderPalletRow>\[\]/);
});

test('/shipping/pallet-ship page consumes the extracted column factory', () => {
  assert.match(page, /import \{[\s\S]*createPalletShipGridColumns[\s\S]*\} from "\.\/palletShipColumns"/);
  assert.match(page, /createPalletShipGridColumns\(\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "palletNo"/);
});
