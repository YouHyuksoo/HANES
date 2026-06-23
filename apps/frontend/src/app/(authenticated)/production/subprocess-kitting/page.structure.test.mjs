import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const pagePath = join(
  process.cwd(),
  'apps/frontend/src/app/(authenticated)/production/subprocess-kitting/page.tsx',
);
const source = readFileSync(pagePath, 'utf8');

test('/production/subprocess-kitting: POST API path is present', () => {
  assert.match(source, /\/production\/subprocess-kitting/);
});

test('/production/subprocess-kitting: GET sg-labels-by-result API path is present', () => {
  assert.match(source, /\/production\/subprocess-kitting\/sg-labels-by-result\//);
});

test('/production/subprocess-kitting: issued SG label barcode is rendered', () => {
  assert.match(source, /sgBarcode/);
});

test('/production/subprocess-kitting: qty field is present', () => {
  assert.match(source, /qty/);
});

test('/production/subprocess-kitting: execute submit button is present', () => {
  assert.match(source, /executeSubmit/);
});

test('/production/subprocess-kitting: no alert/confirm/prompt usage', () => {
  assert.doesNotMatch(source, /\balert\s*\(/);
  assert.doesNotMatch(source, /\bconfirm\s*\(/);
  assert.doesNotMatch(source, /\bprompt\s*\(/);
});

test('/production/subprocess-kitting: uses modal for warnings, not alert', () => {
  assert.match(source, /warnModalOpen|Modal/);
});

test('/production/subprocess-kitting: prod-result POST sends goodQty payload', () => {
  assert.match(source, /\/production\/prod-results/);
  assert.match(source, /goodQty/);
});

test('/production/subprocess-kitting: issued SG labels auto-print via Print Agent host', () => {
  assert.match(source, /SgLabelPrintHost/);
  assert.match(source, /sgPrinterRef\.current\?\.printByResultNo/);
});
