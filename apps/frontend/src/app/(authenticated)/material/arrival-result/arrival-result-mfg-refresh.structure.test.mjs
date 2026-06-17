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

test('arrival result label reprint uses selected mat_lot template through shared agent modal', () => {
  assert.match(source, /api\.get\("\/master\/label-templates",\s*\{\s*params:\s*\{\s*category:\s*"mat_lot"\s*\}/s);
  assert.match(source, /createDefaultLabelDesign\("mat_lot"\)/);
  assert.match(source, /ensureObjectLabelDesign\(rawDesign,\s*"mat_lot"\)/);
  assert.match(source, /Select[\s\S]*aria-label="입하 라벨 템플릿"[\s\S]*selectedTemplateKey[\s\S]*handleTemplateChange/s);
  assert.match(source, /<MatLabelPreviewModal[\s\S]*labelDesign=\{labelDesign\}[\s\S]*templateOptions=\{templateOptions\}[\s\S]*selectedTemplateKey=\{selectedTemplateKey\}[\s\S]*onTemplateChange=\{handleTemplateChange\}/);
});
