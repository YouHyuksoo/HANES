import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./iqcHistoryColumns.tsx', import.meta.url), 'utf8');

test('IQC history LOT No. falls back to sampleBarcode for arrival-level records', () => {
  assert.match(
    columns,
    /export const\s+getLotNoDisplay\s*=\s*\([^)]*record[^)]*\)\s*=>\s*\n?\s*record\.matUid\s*\|\|\s*record\.sampleBarcode\s*\|\|\s*"-"/,
  );
  assert.match(columns, /id:\s*"lotNo"[\s\S]*accessorFn:\s*getLotNoDisplay/);
  assert.match(columns, /const\s+lotNo\s*=\s*getLotNoDisplay\(row\.original\)/);
  assert.match(source, /import\s*\{[^}]*getLotNoDisplay[^}]*\}\s*from\s*"\.\/iqcHistoryColumns"/);
  assert.match(source, /\{getLotNoDisplay\(cancelTarget\)\}/);
});

test('IQC history grid displays arrival number from API rows', () => {
  assert.match(
    columns,
    /accessorKey:\s*"arrivalNo"[\s\S]*header:\s*t\("material\.iqcHistory\.arrivalNo",\s*"입하번호"\)/,
  );
  assert.match(
    columns,
    /accessorKey:\s*"arrivalNo"[\s\S]*<span\s+className="font-mono text-sm">\{\(getValue\(\)\s+as\s+string\)\s*\|\|\s*"-"\}<\/span>/,
  );
});
