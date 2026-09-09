import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const svc = readFileSync(new URL('./label-print.ts', import.meta.url), 'utf8');
const app = (p) => readFileSync(new URL(`../app/(authenticated)/${p}`, import.meta.url), 'utf8');
const shared = readFileSync(new URL('../components/shared/LabelPrintMethodSelect.tsx', import.meta.url), 'utf8');
const indicator = readFileSync(new URL('../components/layout/PrintAgentIndicator.tsx', import.meta.url), 'utf8');

// hswbs(http 공인 주소)에서는 브라우저 정책이 127.0.0.1 Print Agent 요청을 막는다(2026-09-09 실측).
// 모든 라벨 출력 경로는 PC 설정(BROWSER 기본)에 따라 에이전트 없이 브라우저 인쇄로 출력할 수 있어야 한다.
test('label-print service provides a shared browser print path built on the PNG pipeline', () => {
  assert.match(svc, /export type LabelPrintMethod = "BROWSER" \| "AGENT"/);
  assert.match(svc, /LABEL_PRINT_METHOD_STORAGE_KEY = "hanes\.label\.printMethod"/);
  assert.match(svc, /export function readStoredLabelPrintMethod\(\)/);
  assert.match(svc, /export function buildBrowserPrintDocument\(/);
  assert.match(svc, /@page\{size:\$\{widthMm\}mm \$\{heightMm\}mm;margin:0\}/);
  assert.match(svc, /data:image\/png;base64,/);
  assert.match(svc, /export function printPngLabelsInBrowser\(/);
  assert.match(svc, /export async function printLabelNodesViaBrowser\(/);
  // 팝업 차단과 무관한 숨은 iframe 인쇄 + 정리
  assert.match(svc, /createElement\("iframe"\)/);
  assert.match(svc, /iframe\.srcdoc = buildBrowserPrintDocument\(/);
  assert.match(svc, /win\.print\(\)/);
  assert.match(svc, /afterprint/);
  // 브라우저 경로도 반드시 PNG 래스터(바코드 준비 대기)를 거친다 — DOM 마크업 복사 금지
  assert.match(svc, /await renderLabelNodeToPngBase64\(node, widthMm, heightMm\)/);
  assert.doesNotMatch(svc, /innerHTML/);
});

test('every agent print site honours the PC-wide print method (browser fallback)', () => {
  const sites = [
    'material/arrival/components/MatLabelPreviewModal.tsx',
    'production/input-kiosk/components/FgLabelPrintHost.tsx',
    'production/input-kiosk/components/SgLabelPrintHost.tsx',
    'consumables/label/page.tsx',
  ];
  for (const site of sites) {
    const src = app(site);
    assert.match(src, /printPngLabelsInBrowser\(|printLabelNodesViaBrowser\(/, `${site}: browser print path`);
    assert.match(src, /readStoredLabelPrintMethod\(\)|useLabelPrintMethod\(\)/, `${site}: reads PC print method`);
    assert.match(src, /labelPrint\.agentUnavailableHint/, `${site}: agent failure hints browser print`);
    assert.doesNotMatch(src, /alert\(|confirm\(/, `${site}: no alert`);
  }
});

test('print method is selectable from the header agent menu and shared component', () => {
  assert.match(shared, /readStoredLabelPrintMethod/);
  assert.match(shared, /storeLabelPrintMethod/);
  assert.match(shared, /labelPrint\.methodBrowser/);
  assert.match(shared, /labelPrint\.methodAgent/);
  assert.match(indicator, /LabelPrintMethodSelect/);
});
