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
  // PNG 변환(바코드 준비 대기 포함)은 공유 서비스 한 곳 — 화면에 복제하지 않는다
  assert.match(source, /import \{[^}]*renderLabelNodeToPngBase64[^}]*\} from "@\/services\/label-print"/);
  assert.doesNotMatch(source, /function renderLabelNodeToPngBase64/);
  assert.match(source, /jobId:\s*`MAT-ARRIVAL-\$\{item\.key\}`/);

  // 과거 innerHTML 복사식 브라우저 인쇄는 PDF 프린터에서 바코드가 깨졌다. 지금의 브라우저 인쇄는
  // 에이전트와 같은 PNG 파이프라인(renderLabelNodeToPngBase64)을 거친 이미지만 새 창에 넣는다.
  assert.doesNotMatch(source, /createElement\('iframe'\)/);
  assert.doesNotMatch(source, /contentWindow/);
  assert.doesNotMatch(source, /innerHTML/);
  assert.doesNotMatch(source, /@media print/);
  assert.doesNotMatch(source, /api\.get\("\/master\/label-templates"/);
});

test('arrival label modal offers browser print (no agent) through the shared PNG pipeline', () => {
  // 출력 방식 선택은 공유 컴포넌트(PC 별 localStorage) — 화면별 사전을 새로 만들지 않는다
  assert.match(source, /LabelPrintMethodSelect/);
  assert.match(source, /useLabelPrintMethod\(\)/);
  assert.match(source, /printPngLabelsInBrowser\(/);
  assert.match(source, /printMethod === "BROWSER"/);
  // 에이전트 실패 시 브라우저 인쇄로 안내(공통 키)
  assert.match(source, /labelPrint\.agentUnavailableHint/);
  // 창 열기/DOM 복사 방식은 쓰지 않는다(공유 유틸의 iframe+PNG 경로만)
  assert.doesNotMatch(source, /window\.open\(/);
  assert.doesNotMatch(source, /window\.print\(/);
  assert.doesNotMatch(source, /alert\(|confirm\(/);
});
