import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('AQL standards route is registered in the quality menu', () => {
  const menuConfig = read('apps/frontend/src/config/menuConfig.ts');
  assert.match(menuConfig, /code:\s*"QC_AQL"/);
  assert.match(menuConfig, /labelKey:\s*"menu\.quality\.aql"/);
  assert.match(menuConfig, /path:\s*"\/quality\/aql"/);
});

test('AQL menu code is accepted by backend menu validator', () => {
  const validator = read('apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts');
  assert.match(validator, /'QC_AQL'/);
});

test('AQL route has page registry and localized labels', () => {
  const registry = read('apps/frontend/src/components/layout/pageRegistry.generated.ts');
  assert.match(registry, /"\/quality\/aql"/);
  assert.match(registry, /@\/app\/\(authenticated\)\/quality\/aql\/page/);

  for (const locale of ['ko', 'en', 'zh', 'vi']) {
    const source = read(`apps/frontend/src/locales/${locale}.json`);
    const json = JSON.parse(source);
    assert.ok(json.menu['quality.aql'], `${locale} menu.quality.aql is missing`);
    assert.ok(json.quality?.aql?.title, `${locale} quality.aql.title is missing`);
  }
});

test('AQL page entry point exists', () => {
  const pagePath = new URL('./page.tsx', import.meta.url);
  assert.equal(existsSync(pagePath), true);
  const page = readFileSync(pagePath, 'utf8');
  assert.match(page, /AqlPage/);
  assert.match(page, /quality\.aql\.title/);
});
