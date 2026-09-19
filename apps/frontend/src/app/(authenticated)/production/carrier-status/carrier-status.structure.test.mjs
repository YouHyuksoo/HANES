import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./carrierStatusColumns.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./CarrierContentsPanel.tsx', import.meta.url), 'utf8');
const locales = ['ko', 'en', 'zh', 'vi'].map((lang) => ({ lang, json: JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8')) }));

test('대차현황은 기본 필터가 활성(EMPTY 제외)이고 서버 페이징이다', () => {
  assert.match(page, /useState\("ACTIVE"\)/);
  assert.match(page, /carrierStatus: statusFilter/);
  assert.match(page, /ServerPager/);
  assert.match(page, /\/production\/carriers"/);
});

test('바코드로 대차 찾기 입력이 BarcodeScanInput이다', () => {
  assert.match(page, /BarcodeScanInput/);
  assert.match(page, /barcode: barcodeQuery/);
});

test('상태 배지는 ComCodeBadge(CARRIER_STATUS), page는 thin', () => {
  assert.match(columns, /<ComCodeBadge groupCode="CARRIER_STATUS"/);
  assert.match(columns, /export function createCarrierStatusColumns\(/);
  assert.doesNotMatch(page, /accessorKey:/);
  assert.match(panel, /CarrierSlipPrintModal/);
});

test('i18n production.carrierStatus 키', () => {
  for (const k of ['title', 'subtitle', 'findByBarcode', 'loadedCount', 'totalQty', 'lastLoadedAt', 'contents', 'noContents']) {
    for (const { lang, json } of locales) assert.ok(json.production?.carrierStatus?.[k], `${lang}: production.carrierStatus.${k} 누락`);
  }
});
