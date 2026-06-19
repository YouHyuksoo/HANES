import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = readFileSync(new URL('./PoLineReceiptModal.tsx', import.meta.url), 'utf8');

test('receipt modal formats read-only quantity displays with thousand separators', () => {
  assert.match(source, /const\s+formatQuantity\s*=/);
  assert.match(
    source,
    /lotUnitQty\s*===\s*null\s*\?\s*t\('material\.arrival\.singleLot'\)\s*:\s*formatQuantity\(lotUnitQty\)/,
  );
  assert.doesNotMatch(source, /String\(lotUnitQty\)/);
  assert.match(source, /\{receivedQty\.toLocaleString\(\)\}\s*÷\s*\{formatQuantity\(lotUnitQty\)\}\s*→/);
  assert.match(source, /\{expectedCount\.toLocaleString\(\)\}개/);
  assert.doesNotMatch(source, /\{lotUnitQty\s*\?\?\s*['"]-['"]\}/);
});
