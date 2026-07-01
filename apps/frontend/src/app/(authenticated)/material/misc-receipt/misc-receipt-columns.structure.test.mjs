import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/misc-receipt/page.tsx', 'utf8');
const columns = fs.readFileSync('apps/frontend/src/app/(authenticated)/material/misc-receipt/miscReceiptColumns.tsx', 'utf8');
const panelPath = 'apps/frontend/src/app/(authenticated)/material/misc-receipt/components/MiscReceiptRegisterPanel.tsx';
const panel = fs.existsSync(panelPath) ? fs.readFileSync(panelPath, 'utf8') : '';

test('/material/misc-receipt extracts DataGrid columns into miscReceiptColumns.tsx factory', () => {
  assert.match(columns, /export function createMiscReceiptGridColumns\(/);
  assert.match(columns, /\}: CreateMiscReceiptGridColumnsOptions\): ColumnDef<MiscReceiptRecord>\[\]/);
});

test('/material/misc-receipt page consumes the extracted column factory', () => {
  assert.match(page, /import \{ createMiscReceiptGridColumns, MiscReceiptRecord \} from "\.\/miscReceiptColumns"/);
  assert.match(page, /createMiscReceiptGridColumns\(\{ t \}\)/);
  // 인라인 컬럼 배열이 페이지에 남아있지 않아야 한다
  assert.doesNotMatch(page, /accessorKey: "transNo"/);
});

test('/material/misc-receipt uses a fixed right register panel instead of a register modal', () => {
  assert.match(page, /import MiscReceiptRegisterPanel from "\.\/components\/MiscReceiptRegisterPanel"/);
  assert.match(page, /className="h-full flex overflow-hidden animate-fade-in"/);
  assert.match(page, /className="flex-1 min-w-0 flex flex-col overflow-hidden p-6 gap-3"/);
  assert.match(page, /<MiscReceiptRegisterPanel[\s\S]*onClose=\{\(\) => setShowRegister\(false\)\}[\s\S]*onSuccess=\{handleRegistered\}[\s\S]*\/>/);
  assert.doesNotMatch(page, /<Modal\b/);
  assert.doesNotMatch(page, /from "@\/components\/ui";[\s\S]*Modal/);

  assert.ok(fs.existsSync(panelPath), 'MiscReceiptRegisterPanel.tsx should exist');
  assert.match(panel, /w-\[480px\] flex-shrink-0 border-l border-border bg-background flex flex-col h-full overflow-hidden shadow-2xl text-xs animate-slide-in-right/);
  assert.match(panel, /api\.post\("\/material\/misc-receipt"/);
  assert.match(panel, /ComCodeSelect groupCode="RECEIPT_ACCOUNT"/);
  assert.match(panel, /QtyInput/);
});

test('/material/misc-receipt register panel selects parts through the shared PartSearchModal', () => {
  assert.match(panel, /import PartSearchModal, \{ type PartItem \} from "@\/components\/shared\/PartSearchModal"/);
  assert.match(panel, /const \[partModalOpen, setPartModalOpen\] = useState\(false\)/);
  assert.match(panel, /readOnly/);
  assert.match(panel, /onClick=\{\(\) => setPartModalOpen\(true\)\}/);
  assert.match(panel, /<PartSearchModal[\s\S]*isOpen=\{partModalOpen\}[\s\S]*onClose=\{\(\) => setPartModalOpen\(false\)\}[\s\S]*onSelect=\{handleSelectPart\}[\s\S]*\/>/);
  assert.doesNotMatch(panel, /api\.get\("\/master\/parts"/);
});
