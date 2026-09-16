import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const columns = readFileSync(new URL('./limitSampleColumns.tsx', import.meta.url), 'utf8');
const panel = readFileSync(new URL('./LimitSampleFormPanel.tsx', import.meta.url), 'utf8');
const images = readFileSync(new URL('./LimitSampleImageSection.tsx', import.meta.url), 'utf8');

const locales = ['ko', 'en', 'zh', 'vi'].map((lang) => ({
  lang,
  json: JSON.parse(readFileSync(new URL(`../../../../locales/${lang}.json`, import.meta.url), 'utf8')),
}));

test('/master/limit-sample keeps page.tsx thin: columns + panels are separate files', () => {
  assert.match(columns, /export function createLimitSampleGridColumns\(/);
  assert.match(columns, /\): ColumnDef<LimitSampleRow>\[\]/);
  assert.match(page, /from "\.\/limitSampleColumns"/);
  assert.match(page, /from "\.\/LimitSampleFormPanel"/);
  assert.match(panel, /from "\.\/LimitSampleImageSection"/);
  assert.doesNotMatch(page, /accessorKey:/);
});

test('type tabs filter by sampleType and expiring summary comes from /expiring', () => {
  assert.match(page, /role="tablist"/);
  for (const type of ['OK', 'NG']) {
    assert.match(page, new RegExp(`value: "${type}"`), `${type} 탭 누락`);
  }
  assert.match(page, /params\.sampleType = typeTab/);
  assert.match(page, /\/master\/limit-samples\/expiring/);
  assert.match(page, /days: EXPIRING_DAYS/);
  assert.match(page, /const EXPIRING_DAYS = 30/);
});

test('expiry badges are text/border only (no pastel background) and read server expiryState', () => {
  assert.match(columns, /export function ExpiryBadge/);
  assert.match(columns, /expiryState === "EXPIRED"/);
  assert.match(columns, /expiryState === "EXPIRING"/);
  assert.match(columns, /border-red-600/);
  assert.match(columns, /border-amber-600/);
  for (const src of [page, columns, panel, images]) {
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-50\b/);
    assert.doesNotMatch(src, /bg-(?:green|red|yellow|blue|amber|orange|purple|cyan|teal)-100\b/);
  }
  assert.match(columns, /<InspectItemImage/);
});

test('right-side panel follows master panel standard (top actions, data swap, unsaved guard)', () => {
  assert.match(page, /useUnsavedGuard/);
  assert.match(page, /markDirty\(dirty\)/);
  assert.match(page, /initialFormRef\.current = next/);
  assert.doesNotMatch(page, /<LimitSampleFormPanel[^>]*\skey=/);
  assert.match(panel, /animate-slide-in-right/);
  const headerBlock = panel.slice(panel.indexOf('border-b border-border'), panel.indexOf('overflow-y-auto'));
  assert.match(headerBlock, /onClick=\{onCancel\}/);
  assert.match(headerBlock, /onClick=\{onSave\}/);
});

test('coded values use shared select components', () => {
  assert.match(panel, /<ComCodeSelect groupCode="LIMIT_SAMPLE_TYPE"/);
  assert.match(panel, /<ComCodeSelect groupCode="LIMIT_SAMPLE_STATUS"/);
  assert.match(panel, /<PartSelect[\s\S]*value=\{form\.itemCode\}/);
  assert.match(panel, /<ProcessSelect[\s\S]*value=\{form\.processCode\}/);
  assert.match(panel, /<UseYnSelect includeAll=\{false\}/);
  assert.match(page, /\/quality\/defect-codes\/options/);
  assert.match(columns, /<ComCodeBadge groupCode="LIMIT_SAMPLE_TYPE"/);
  assert.match(columns, /<ComCodeBadge groupCode="LIMIT_SAMPLE_STATUS"/);
});

test('photos are multi-image with a single primary, through :code/images endpoints', () => {
  // 대표는 견본당 1장 — 라디오로만 지정한다
  assert.match(images, /type="radio"/);
  assert.match(images, /isPrimary/);
  assert.match(page, /\/master\/limit-samples\/\$\{encodeURIComponent\(sampleCode\)\}\/images/);
  assert.match(page, /images\/\$\{/);
  assert.match(images, /accept="image\/jpeg,image\/png,image\/gif,image\/webp"/);
  assert.match(images, /multiple/);
  assert.match(page, /imageDeleteTarget/);
});

test('no browser dialogs and no as any anywhere on the screen', () => {
  for (const banned of [/\balert\(/, /\bconfirm\(/, /\bprompt\(/, /as any/]) {
    for (const src of [page, columns, panel, images]) assert.doesNotMatch(src, banned);
  }
});

test('list uses server paging with default active filter', () => {
  assert.match(page, /ServerPager/);
  assert.match(page, /useState\("Y"\)/);
  assert.match(page, /params\.useYn = useYnFilter/);
});

test('every master.limitSample key used on screen exists in all 4 locales', () => {
  const used = new Set();
  for (const src of [page, columns, panel, images]) {
    for (const m of src.matchAll(/t\("(master\.limitSample\.[A-Za-z0-9_.]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 0, 'master.limitSample.* 키를 하나도 쓰지 않았다');
  for (const { lang, json } of locales) {
    for (const key of used) {
      const value = key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), json);
      assert.equal(typeof value, 'string', `${lang}.json 에 ${key} 누락`);
    }
  }
});

test('comCode labels for the new groups exist in all 4 locales', () => {
  for (const { lang, json } of locales) {
    for (const code of ['OK', 'NG']) {
      assert.equal(typeof json.comCode?.LIMIT_SAMPLE_TYPE?.[code], 'string', `${lang}: LIMIT_SAMPLE_TYPE.${code}`);
    }
    for (const code of ['ACTIVE', 'EXPIRED', 'RETIRED']) {
      assert.equal(typeof json.comCode?.LIMIT_SAMPLE_STATUS?.[code], 'string', `${lang}: LIMIT_SAMPLE_STATUS.${code}`);
    }
    assert.equal(typeof json.menu?.['master.limitSample'], 'string', `${lang}: menu 라벨 누락`);
  }
});
