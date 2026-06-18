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

test('/production/subprocess-kitting: GET sg-label API path is present', () => {
  assert.match(source, /\/production\/subprocess-kitting\/sg-label\//);
});

test('/production/subprocess-kitting: SG scan input is present', () => {
  assert.match(source, /sgBarcode|sgInput|sg-label/);
});

test('/production/subprocess-kitting: qty field is present', () => {
  assert.match(source, /qty/);
});

test('/production/subprocess-kitting: execute kitting button is present', () => {
  assert.match(source, /executeKitting|kitting\.execute/);
});

test('/production/subprocess-kitting: no alert/confirm/prompt usage', () => {
  assert.doesNotMatch(source, /\balert\s*\(/);
  assert.doesNotMatch(source, /\bconfirm\s*\(/);
  assert.doesNotMatch(source, /\bprompt\s*\(/);
});

test('/production/subprocess-kitting: uses modal for warnings, not alert', () => {
  assert.match(source, /warnModalOpen|Modal/);
});

test('/production/subprocess-kitting: sgBarcodes array is sent in POST payload', () => {
  assert.match(source, /sgBarcodes/);
});

test('/production/subprocess-kitting: fgBarcodes result is displayed', () => {
  assert.match(source, /fgBarcodes/);
});
