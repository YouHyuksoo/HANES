import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./MatLabelPreviewModal.tsx', import.meta.url), 'utf8');

// 모달 내부 window.print()는 Modal 조상(fixed inset-0, overflow-y-auto max-h-[75vh],
// body overflow:hidden)에 클리핑되어 라벨 N장 중 첫 페이지 1장만 인쇄된다.
// 또한 window.open 새 창 인쇄는 팝업 차단 시 조용히 무반응이 된다.
// → 팝업 차단과 무관한 숨김 iframe에 라벨 HTML을 복사해 인쇄해야 한다.
test('label reprint prints via a hidden iframe, not the clipped modal DOM or a blockable popup', () => {
  // 숨김 iframe 인쇄 패턴
  assert.match(source, /createElement\('iframe'\)/);
  assert.match(source, /contentWindow/);
  assert.match(source, /printRef/);
  // iframe 문서에 라벨 페이지 규격과 페이지 분할 규칙 포함
  assert.match(source, /@page\{size:\$\{MATERIAL_ARRIVAL_LABEL_WIDTH_MM\}mm \$\{MATERIAL_ARRIVAL_LABEL_HEIGHT_MM\}mm;margin:0\}/);
  assert.match(source, /page-break-inside:avoid/);
  // 팝업(차단 가능) 패턴 금지
  assert.doesNotMatch(source, /window\.open\(/);
  // 모달 DOM을 그대로 인쇄하는 패턴 금지
  assert.doesNotMatch(source, /const handlePrint = \(\) => window\.print\(\)/);
  assert.doesNotMatch(source, /@media print/);
});
