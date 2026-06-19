import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('IQC history LOT No. falls back to sampleBarcode for arrival-level records', () => {
  assert.match(
    source,
    /const\s+getLotNoDisplay\s*=\s*\([^)]*record[^)]*\)\s*=>\s*\n?\s*record\.matUid\s*\|\|\s*record\.sampleBarcode\s*\|\|\s*"-"/,
  );
  assert.match(source, /id:\s*"lotNo"[\s\S]*accessorFn:\s*getLotNoDisplay/);
  assert.match(source, /const\s+lotNo\s*=\s*getLotNoDisplay\(row\.original\)/);
  assert.match(source, /\{getLotNoDisplay\(cancelTarget\)\}/);
});

test('IQC history grid displays arrival number from API rows', () => {
  assert.match(
    source,
    /accessorKey:\s*"arrivalNo"[\s\S]*header:\s*"입하번호"/,
  );
  assert.match(
    source,
    /accessorKey:\s*"arrivalNo"[\s\S]*<span\s+className="font-mono text-sm">\{\(getValue\(\)\s+as\s+string\)\s*\|\|\s*"-"\}<\/span>/,
  );
});
