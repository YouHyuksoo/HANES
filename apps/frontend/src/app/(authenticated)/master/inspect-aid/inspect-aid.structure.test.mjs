import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./inspectAidColumns.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./InspectAidFormPanel.tsx', import.meta.url), 'utf8');

test('/master/inspect-aid keeps page.tsx thin: columns + form panel are separate files', () => {
  assert.match(columns, /export function createInspectAidGridColumns\(/);
  assert.match(columns, /\): ColumnDef<InspectAidRow>\[\]/);
  assert.match(page, /from "\.\/inspectAidColumns"/);
  assert.match(page, /from "\.\/InspectAidFormPanel"/);
  assert.doesNotMatch(page, /accessorKey:/);
  assert.doesNotMatch(page, /<Input\s+label=/);
});

test('type tabs filter the list by aidType and expiring summary comes from /expiring', () => {
  assert.match(page, /role="tablist"/);
  for (const type of ['LIMIT_OK', 'LIMIT_NG', 'HOLDER']) {
    assert.match(page, new RegExp(`value: "${type}"`), `${type} 탭 누락`);
  }
  assert.match(page, /params\.aidType = typeTab/);
  assert.match(page, /\/master\/inspect-aids\/expiring/);
  assert.match(page, /days: EXPIRING_DAYS/);
  assert.match(page, /const EXPIRING_DAYS = 30/);
});

test('expiry badges are text/border only (no pastel background) and read server expiryState', () => {
  assert.match(columns, /export function ExpiryBadge/);
  assert.match(columns, /expiryState === "EXPIRED"/);
  assert.match(columns, /expiryState === "EXPIRING"/);
  assert.match(columns, /border-red-600/);
  assert.match(columns, /border-amber-600/);
  for (const src of [page, columns, panel]) {
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-50\b/);
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-100\b/);
  }
  assert.match(columns, /<InspectItemImage/);
});

test('right-side panel follows master panel standard (top actions, data swap, unsaved guard)', () => {
  assert.match(page, /useUnsavedGuard/);
  assert.match(page, /markDirty\(dirty\)/);
  assert.match(page, /initialFormRef\.current = next/);
  assert.doesNotMatch(page, /<InspectAidFormPanel[^>]*\skey=/);
  assert.match(panel, /animate-slide-in-right/);
  const headerBlock = panel.slice(panel.indexOf('border-b border-border'), panel.indexOf('overflow-y-auto'));
  assert.match(headerBlock, /onClick=\{onCancel\}/);
  assert.match(headerBlock, /onClick=\{onSave\}/);
});

test('coded values use shared select components', () => {
  assert.match(panel, /<ComCodeSelect groupCode="INSPECT_AID_TYPE"/);
  assert.match(panel, /<ComCodeSelect groupCode="INSPECT_AID_STATUS"/);
  assert.match(panel, /<PartSelect[\s\S]*value=\{form\.itemCode\}/);
  assert.match(panel, /<ProcessSelect[\s\S]*value=\{form\.processCode\}/);
  assert.match(panel, /<UseYnSelect includeAll=\{false\}/);
  assert.match(page, /\/quality\/defect-codes\/options/);
  assert.match(columns, /<ComCodeBadge groupCode="INSPECT_AID_TYPE"/);
  assert.match(columns, /<ComCodeBadge groupCode="INSPECT_AID_STATUS"/);
});

test('image upload/replace/delete goes through :code/image with ConfirmModal, no browser dialogs', () => {
  assert.match(page, /\/master\/inspect-aids\/\$\{encodeURIComponent\(aidCode\)\}\/image/);
  assert.match(page, /api\.delete\(`\/master\/inspect-aids\/\$\{encodeURIComponent\(editing\.aidCode\)\}\/image`\)/);
  assert.match(panel, /accept="image\/jpeg,image\/png,image\/gif,image\/webp"/);
  assert.match(panel, /imageChange/);
  assert.match(page, /imageDeleteConfirmOpen/);
  for (const banned of [/\balert\(/, /\bconfirm\(/, /\bprompt\(/, /as any/]) {
    assert.doesNotMatch(page, banned);
    assert.doesNotMatch(panel, banned);
    assert.doesNotMatch(columns, banned);
  }
});

test('list uses server paging with default active filter', () => {
  assert.match(page, /ServerPager/);
  assert.match(page, /useState\("Y"\)/);
  assert.match(page, /params\.useYn = useYnFilter/);
});
