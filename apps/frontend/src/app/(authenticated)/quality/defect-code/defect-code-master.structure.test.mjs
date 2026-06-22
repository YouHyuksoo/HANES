import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('defect code master is registered as a quality menu leaf', () => {
  const menu = read('apps/frontend/src/config/menuConfig.ts');
  assert.match(menu, /code:\s*"QC_DEFECT_CODE"/);
  assert.match(menu, /labelKey:\s*"menu\.quality\.defectCode"/);
  assert.match(menu, /path:\s*"\/quality\/defect-code"/);

  const validator = read('apps/backend/src/modules/menu-categories/utils/menu-code-validator.ts');
  assert.match(validator, /'QC_DEFECT_CODE'/);

  const seed = read('apps/backend/src/seeds/menu-config.json');
  assert.match(seed, /"QC_DEFECT_CODE"/);
});

test('defect code master page uses the dedicated defect-code API and 3-level category model', () => {
  const page = read('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx');
  assert.match(page, /\/quality\/defect-codes\/categories/);
  assert.match(page, /\/quality\/defect-codes/);
  assert.match(page, /levelNo/);
  assert.match(page, /parentCategoryCode/);
  assert.match(page, /productTypes/);
  assert.match(page, /defectGrade/);
  assert.match(page, /defectScope/);
});

test('defect code master uses a simple all-code grid with level selectors in the form', () => {
  const page = read('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx');
  assert.doesNotMatch(page, /data-testid="defect-category-tree"/);
  assert.doesNotMatch(page, /L\{node\.levelNo\}/);
  assert.doesNotMatch(page, /function CategoryNode/);
  assert.match(page, /data-testid="defect-code-grid"/);
  assert.match(page, /quality\.defectCode\.allCodes/);
  assert.match(page, /selectedLevel1/);
  assert.match(page, /selectedLevel2/);
  assert.match(page, /selectedLevel3/);
  assert.match(page, /quality\.defectCode\.level1/);
  assert.match(page, /quality\.defectCode\.level2/);
  assert.match(page, /quality\.defectCode\.level3/);
  assert.doesNotMatch(page, /params\.categoryCode/);
});

test('defect code registration derives model group from selected level 2 category', () => {
  const page = read('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx');
  assert.match(page, /modelGroupFromLevel2Code\(selectedLevel1,\s*selectedLevel2\)/);
  assert.match(page, /const selectedModelGroup = modelGroupFromLevel2Code\(selectedLevel1,\s*selectedLevel2\)/);
  assert.match(page, /productTypes:\s*selectedModelGroup \? \[selectedModelGroup\] : \[\]/);
  assert.doesNotMatch(page, /productTypeOptions\.map/);
  assert.doesNotMatch(page, /setProductType/);
  assert.match(page, /모델구분/);
  assert.doesNotMatch(page, /제품류별 불량코드/);
});

test('defect code grid separates category levels into three columns', () => {
  const page = read('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx');
  assert.match(page, /categoryLevels\(row\.categoryCode\)/);
  assert.match(page, /quality\.defectCode\.level1/);
  assert.match(page, /quality\.defectCode\.level2/);
  assert.match(page, /quality\.defectCode\.level3/);
  assert.doesNotMatch(page, /quality\.defectCode\.categoryPath/);
  assert.doesNotMatch(page, /categoryPath\(row\.categoryCode\)/);
  assert.match(page, /\{levels\.level1\}/);
  assert.match(page, /\{levels\.level2\}/);
  assert.match(page, /\{levels\.level3\}/);
});

test('defect code page uses bounded flex height instead of viewport calc overflow', () => {
  const page = read('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx');
  assert.doesNotMatch(page, /h-\[calc\(100vh-150px\)\]/);
  assert.match(page, /className="h-full min-h-0 overflow-hidden p-6 animate-fade-in flex flex-col"/);
  assert.match(page, /className="mb-4 flex shrink-0 items-center justify-between"/);
  assert.match(page, /className="grid min-h-0 flex-1 grid-cols-\[minmax\(620px,1fr\)_440px\] gap-4"/);
});

test('defect code master form labels do not expose raw database field keys', () => {
  const page = read('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx');
  for (const rawLabel of [
    'levelNo',
    'parentCategoryCode',
    'categoryCode',
    'categoryName',
    'defectCode',
    'defectName',
    'defectGrade',
    'defectScope',
    'useYn',
    'description',
  ]) {
    assert.doesNotMatch(page, new RegExp(`label="${rawLabel}"`));
  }

  for (const key of [
    'level',
    'parentCategory',
    'categoryCode',
    'categoryName',
    'defectCode',
    'defectName',
    'grade',
    'scope',
    'useYn',
    'description',
  ]) {
    assert.match(page, new RegExp(`quality\\.defectCode\\.${key}`));
  }
});

test('defect code master translates enum values instead of rendering raw keys', () => {
  const page = read('apps/frontend/src/app/(authenticated)/quality/defect-code/page.tsx');

  for (const rawOption of ['label: "CRITICAL"', 'label: "MAJOR"', 'label: "MINOR"']) {
    assert.doesNotMatch(page, new RegExp(rawOption));
  }

  assert.doesNotMatch(page, /<td className="px-2 py-2">\{row\.defectGrade\}<\/td>/);
  assert.doesNotMatch(page, /<td className="px-2 py-2">\{row\.defectScope\}<\/td>/);
  assert.doesNotMatch(page, /<td className="px-2 py-2">\{row\.useYn\}<\/td>/);
  assert.match(page, /formatDefectGrade\(row\.defectGrade\)/);
  assert.match(page, /formatDefectScope\(row\.defectScope\)/);
  assert.match(page, /formatUseYn\(row\.useYn\)/);

  for (const key of ['gradeCritical', 'gradeMajor', 'gradeMinor']) {
    assert.match(page, new RegExp(`quality\\.defectCode\\.${key}`));
  }
});

test('defect code master has a lazy page registry entry', () => {
  const registry = read('apps/frontend/src/components/layout/page-registries/quality__defect-code.generated.ts');
  assert.match(registry, /quality\/defect-code\/page/);
});

test('defect code menu labels exist in all locales', () => {
  for (const locale of ['ko', 'en', 'zh', 'vi']) {
    const json = read(`apps/frontend/src/locales/${locale}.json`);
    assert.match(json, /"defectCode"\s*:/);
  }
});
