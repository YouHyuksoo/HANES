import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

test('manufacturer change updates selected panel and result rows without manual refresh', () => {
  assert.match(source, /usePartnerOptions\("MFG"\)/);
  assert.match(source, /resolveMfgPartnerName/);
  assert.match(source, /const updatedSelected[\s\S]*mfgPartnerCode:\s*mfgCode[\s\S]*mfgPartnerName:\s*nextMfgPartnerName/);
  assert.match(source, /setSelected\(updatedSelected\)/);
  assert.match(source, /setRows\(\(prev\)\s*=>\s*prev\.map/);
  assert.doesNotMatch(source, /loadSerials\(selected\);/);
});
