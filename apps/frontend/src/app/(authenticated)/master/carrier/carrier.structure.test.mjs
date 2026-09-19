import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./carrierColumns.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./CarrierFormPanel.tsx', import.meta.url), 'utf8');
const label = readFileSync(new URL('./CarrierLabelModal.tsx', import.meta.url), 'utf8');
const locales = ['ko', 'en', 'zh', 'vi'].map((lang) => ({
  lang,
  json: JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8')),
}));

test('/master/carrier keeps page thin: columns/panel/label are separate files', () => {
  assert.match(columns, /export function createCarrierGridColumns\(/);
  assert.match(columns, /\): ColumnDef<CarrierRow>\[\]/);
  assert.match(page, /from "\.\/carrierColumns"/);
  assert.match(page, /from "\.\/CarrierFormPanel"/);
  assert.match(page, /from "\.\/CarrierLabelModal"/);
  assert.doesNotMatch(page, /accessorKey:/);
});

test('coded values use shared selects and badges', () => {
  assert.match(panel, /<ComCodeSelect groupCode="CARRIER_TYPE"/);
  assert.match(panel, /<UseYnSelect/);
  assert.match(columns, /<ComCodeBadge groupCode="CARRIER_TYPE"/);
  assert.match(page, /ServerPager/);
});

test('right-side panel follows master panel standard (top actions, data swap, unsaved guard)', () => {
  assert.match(page, /useUnsavedGuard/);
  assert.match(page, /markDirty\(dirty\)/);
  assert.match(page, /initialFormRef\.current = next/);
  assert.doesNotMatch(page, /<CarrierFormPanel[^>]*\skey=/);
  assert.match(panel, /animate-slide-in-right/);
  const headerBlock = panel.slice(panel.indexOf('border-b border-border'), panel.indexOf('overflow-y-auto'));
  assert.match(headerBlock, /onClick=\{onCancel\}/);
  assert.match(headerBlock, /onClick=\{onSave\}/);
});

test('label modal prints QR of carrierNo only (kiosk scans the raw number)', () => {
  assert.match(label, /<QRCode value=\{carrier\.carrierNo\}/);
  assert.match(label, /window\.print\(\)/);
  assert.match(label, /@page \{ size: 60mm 55mm/);
});

test('no pastel backgrounds, no alert/confirm', () => {
  for (const src of [page, columns, panel, label]) {
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-(?:50|100)\b/);
    assert.doesNotMatch(src, /\balert\(|\bconfirm\(/);
  }
});

test('i18n master.carrier keys exist in 4 locales', () => {
  const keys = ['title', 'subtitle', 'carrierNo', 'carrierType', 'carrierName', 'capacity', 'capacityUnlimited', 'searchPlaceholder', 'qrLabelTitle', 'qrLabelHeader'];
  for (const { lang, json } of locales) {
    for (const k of keys) assert.ok(json.master?.carrier?.[k], `${lang}: master.carrier.${k} 누락`);
  }
});
