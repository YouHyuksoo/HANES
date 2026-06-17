import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./MatLabelPreviewModal.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');

test('arrival label modal prints selected mat_lot template through local print-agent', () => {
  assert.match(page, /api\.get\('\/master\/label-templates',\s*\{\s*params:\s*\{\s*category:\s*'mat_lot'\s*\}/s);
  assert.match(page, /Select[\s\S]*aria-label="입하 라벨 템플릿"[\s\S]*selectedTemplateKey[\s\S]*handleTemplateChange/s);
  assert.match(page, /labelDesign=\{labelDesign\}/);
  assert.match(page, /templateOptions=\{templateOptions\}/);
  assert.match(page, /selectedTemplateKey=\{selectedTemplateKey\}/);
  assert.match(page, /onTemplateChange=\{handleTemplateChange\}/);

  assert.match(source, /Select[\s\S]*selectedTemplateKey[\s\S]*handleTemplateChange/s);

  assert.match(source, /LabelDesignRenderer/);
  assert.match(source, /printAgentPng/);
  assert.match(source, /renderLabelNodeToPngBase64/);
  assert.match(source, /waitForLabelRenderReady/);
  assert.match(source, /data-label-barcode-pending/);
  assert.match(source, /jobId:\s*`MAT-ARRIVAL-\$\{item\.key\}`/);

  // 과거 브라우저 인쇄 경로는 PDF 프린터 출력에서 바코드가 깨질 수 있어 사용하지 않는다.
  assert.doesNotMatch(source, /createElement\('iframe'\)/);
  assert.doesNotMatch(source, /contentWindow/);
  assert.doesNotMatch(source, /window\.open\(/);
  assert.doesNotMatch(source, /window\.print\(/);
  assert.doesNotMatch(source, /@media print/);
  assert.doesNotMatch(source, /api\.get\("\/master\/label-templates"/);
});
