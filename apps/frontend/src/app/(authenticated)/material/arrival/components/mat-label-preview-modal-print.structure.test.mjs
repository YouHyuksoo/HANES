import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./MatLabelPreviewModal.tsx', import.meta.url), 'utf8');
const page = readFileSync(new URL('../page.tsx', import.meta.url), 'utf8');

test('arrival label modal prints selected mat_lot template through local print-agent', () => {
  assert.match(page, /api\.get\('\/master\/label-templates',\s*\{\s*params:\s*\{\s*category:\s*'mat_lot'\s*\}/s);
  assert.match(page, /Select[\s\S]*aria-label=\{t\('material\.arrival\.labelTemplate', '입하 라벨 템플릿'\)\}[\s\S]*selectedTemplateKey[\s\S]*handleTemplateChange/s);
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

  // 과거 innerHTML 복사식 브라우저 인쇄는 PDF 프린터에서 바코드가 깨졌다. 지금의 브라우저 인쇄는
  // 에이전트와 같은 PNG 파이프라인(renderLabelNodeToPngBase64)을 거친 이미지만 새 창에 넣는다.
  assert.doesNotMatch(source, /createElement\('iframe'\)/);
  assert.doesNotMatch(source, /contentWindow/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /@media print/);
  assert.doesNotMatch(source, /api\.get\("\/master\/label-templates"/);
});

test('arrival label modal offers browser print (no agent) using the same PNG pipeline', () => {
  // 출력 방식 선택: BROWSER(기본, PC 별 기억) / AGENT
  assert.match(source, /type MatLabelPrintMethod = "BROWSER" \| "AGENT"/);
  assert.match(source, /MAT_LABEL_PRINT_METHOD_STORAGE_KEY = "hanes\.matLabel\.printMethod"/);
  assert.match(source, /material\.arrival\.label\.printMethodBrowser/);
  assert.match(source, /material\.arrival\.label\.printMethodAgent/);
  // 팝업 차단 회피: 클릭 핸들러에서 동기적으로 창을 연 뒤 PNG 를 채운다
  assert.match(source, /browserWindow = window\.open\("", "_blank"\)/);
  assert.match(source, /buildBrowserPrintDocument\(/);
  assert.match(source, /data:image\/png;base64,/);
  assert.match(source, /@page\{size:\$\{widthMm\}mm \$\{heightMm\}mm;margin:0\}/);
  assert.match(source, /win\.print\(\)/);
  assert.match(source, /afterprint/);
  // 에이전트 실패 시 브라우저 인쇄로 안내
  assert.match(source, /material\.arrival\.label\.agentUnavailableHint/);
  assert.doesNotMatch(source, /alert\(|confirm\(/);
});
