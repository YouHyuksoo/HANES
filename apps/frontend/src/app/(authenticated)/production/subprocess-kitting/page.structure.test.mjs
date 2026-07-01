import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const pagePath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx',
);
const source = readFileSync(pagePath, 'utf8');

test('/production/subprocess-kitting: issue-sg-label POST API path is present', () => {
  assert.match(source, /\/production\/subprocess-kitting\/issue-sg-label/);
});

test('/production/subprocess-kitting: confirm-subkit POST API path is present', () => {
  assert.match(source, /\/production\/subprocess-kitting\/confirm-subkit/);
});

test('/production/subprocess-kitting: input SG scan uses sg-label lookup', () => {
  // 입력 SG 스캔 검증은 InputSgScanPanel 컴포넌트가 담당 (GET .../sg-label/:barcode)
  assert.match(source, /InputSgScanPanel/);
});

test('/production/subprocess-kitting: circuits-by-order is loaded for circuit select', () => {
  assert.match(source, /\/production\/subprocess-kitting\/circuits-by-order\//);
});

test('/production/subprocess-kitting: two-step issue -> physical confirm scan flow', () => {
  assert.match(source, /issuedSg/);
  assert.match(source, /onConfirmScan/);
});

test('/production/subprocess-kitting: SEMI_PRODUCT job order filter', () => {
  assert.match(source, /SEMI_PRODUCT/);
});

test('/production/subprocess-kitting: job order modal uses kiosk-equivalent filters', () => {
  assert.match(source, /filterStatus=\{\['WAITING', 'RUNNING'\]\}/);
  assert.match(source, /equipCode=\{equipCode \|\| undefined\}/);
  assert.match(source, /orderKind="OPERATION"/);
  assert.match(source, /processCode=\{processCode \|\| undefined\}/);
  assert.match(source, /itemType="SEMI_PRODUCT"/);
});

test('/production/subprocess-kitting: typed job order lookup uses kiosk-equivalent filters', () => {
  assert.match(source, /statuses: "WAITING,RUNNING"/);
  assert.match(source, /orderKind: "OPERATION"/);
  assert.match(source, /equipCode/);
  assert.match(source, /itemType: "SEMI_PRODUCT"/);
});

test('/production/subprocess-kitting: no alert/confirm/prompt usage', () => {
  assert.doesNotMatch(source, /\balert\s*\(/);
  assert.doesNotMatch(source, /\bconfirm\s*\(/);
  assert.doesNotMatch(source, /\bprompt\s*\(/);
});

test('/production/subprocess-kitting: issued SG label auto-print via Print Agent host', () => {
  assert.match(source, /SgLabelPrintHost/);
  assert.match(source, /sgPrinterRef\.current\?\.printBySgBarcodes/);
});
