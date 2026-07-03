import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./date.ts', import.meta.url), 'utf8');

test('date.ts exposes a local date-only formatter without fixed deployment timezone', () => {
  assert.match(src, /export function formatDateOnly\(/);
  assert.doesNotMatch(src, /timeZone:\s*['"][^'"]+['"]/);
  assert.doesNotMatch(src, /Asia\/Seoul/);
});

test('BOM API formats date-only fields as YYYY-MM-DD before JSON serialization', () => {
  const bomService = readFileSync(new URL('../../../backend/src/modules/master/services/bom.service.ts', import.meta.url), 'utf8');

  assert.match(bomService, /TO_CHAR\(MIN\(b\.VALID_FROM\), 'YYYY-MM-DD'\) AS "validFrom"/);
  assert.match(bomService, /TO_CHAR\(MAX\(b\.VALID_TO\), 'YYYY-MM-DD'\) AS "validTo"/);
  assert.match(bomService, /TO_CHAR\(b\.VALID_FROM, 'YYYY-MM-DD'\)\s+AS "validFrom"/);
  assert.match(bomService, /TO_CHAR\(b\.VALID_TO, 'YYYY-MM-DD'\)\s+AS "validTo"/);
});

test('BOM callers use the shared formatter instead of UTC ISO slicing', () => {
  const bomTab = readFileSync(new URL('../app/(authenticated)/master/bom/components/BomTab.tsx', import.meta.url), 'utf8');
  const bomForm = readFileSync(new URL('../app/(authenticated)/master/bom/components/BomFormModal.tsx', import.meta.url), 'utf8');

  assert.match(bomTab, /formatDateOnly/);
  assert.doesNotMatch(bomTab, /toISOString\(\)\.split\(["']T["']\)\[0\]/);
  assert.match(bomForm, /formatDateOnly/);
  assert.doesNotMatch(bomForm, /split\(["']T["']\)\[0\]/);
});
