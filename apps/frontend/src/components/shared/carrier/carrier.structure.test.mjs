import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const locales = ['ko', 'en', 'zh', 'vi'].map((lang) => ({
  lang, json: JSON.parse(readFileSync(new URL(`../../../locales/${lang}.json`, import.meta.url), 'utf8')),
}));

test('공용 대차 모듈은 타입·출력슬롯 훅·슬롯 UI·전표 인쇄·자동투입 훅을 export 한다', () => {
  const index = read('./index.ts');
  for (const name of ['OutputCarrierSlot', 'CarrierSlipPrintModal', 'useOutputCarrier', 'useCarrierAutoInput', 'useCarrierProcessFlags', 'isLikelyLabelBarcode']) {
    assert.match(index, new RegExp(name), `${name} export 누락`);
  }
});

test('출력 슬롯은 BarcodeScanInput을 쓰고 alert/confirm·파스텔 배경을 쓰지 않는다', () => {
  const slot = read('./OutputCarrierSlot.tsx');
  assert.match(slot, /BarcodeScanInput/);
  assert.match(slot, /data-testid="carrier-slot-scan"/);
  assert.match(slot, /data-testid="carrier-slot-slip"/);
  assert.doesNotMatch(slot, /\balert\(|\bconfirm\(/);
  assert.doesNotMatch(slot, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-(?:50|100)\b/);
});

test('전표 인쇄는 A4 window.print 패턴이고 대차번호 QR을 담는다', () => {
  const slip = read('./CarrierSlipPrintModal.tsx');
  assert.match(slip, /window\.print\(\)/);
  assert.match(slip, /@page \{ size: A4 portrait/);
  assert.match(slip, /<QRCode value=\{slip\.carrierNo\}/);
  assert.match(slip, /\/production\/carriers\/\$\{encodeURIComponent\(carrierNo\)\}\/slip/);
});

test('자동투입 훅은 라벨 접두어면 대차 조회를 건너뛰고, 바코드마다 화면 처리기를 반복 호출한다', () => {
  const hook = read('./useCarrierAutoInput.ts');
  assert.match(hook, /export function isLikelyLabelBarcode/);
  assert.match(hook, /\^\(SG\|FG\)\\d/);
  assert.match(hook, /VH1-RM/);
  assert.match(hook, /\/auto-input/);
  assert.match(hook, /for \(const row of rows\)/);
  assert.match(hook, /await handleBarcode\(row\.barcode\)/);
});

test('i18n carrier 키가 4개 로케일에 있다', () => {
  const keys = ['slotLabel', 'scanPlaceholder', 'empty', 'loaded', 'inTransit', 'slip', 'clear', 'capacityFull', 'autoInputDone', 'autoInputFailed', 'notCarrier', 'slipTitle', 'from', 'to', 'toFinal', 'issuedAt', 'reprint'];
  for (const { lang, json } of locales) for (const k of keys) assert.ok(json.carrier?.[k], `${lang}: carrier.${k} 누락`);
});
