import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pagePath = 'apps/frontend/src/app/(authenticated)/quality/aql/page.tsx';
const controllerPath = 'apps/backend/src/modules/quality/aql/controllers/aql.controller.ts';
const modulePath = 'apps/backend/src/modules/quality/aql/aql.module.ts';
const policyEntityPath = 'apps/backend/src/entities/iqc-aql-policy.entity.ts';
const migrationPath = 'apps/backend/src/migrations/2026-06-21_iqc_aql_policy_code.sql';
const helpPath = 'apps/frontend/src/app/(authenticated)/quality/aql/components/AqlFieldHelp.tsx';

test('AQL page uses the real AQL API and registration fields', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /api\.get\(["']\/quality\/aql["']/);
  assert.match(page, /api\.post\(["']\/quality\/aql["']/);
  assert.match(page, /api\.put\(`\/quality\/aql\/\$\{encodeURIComponent\(form\.aqlCode\)\}`/);
  assert.match(page, /api\.delete\(`\/quality\/aql\/\$\{encodeURIComponent\(selected\.aqlCode\)\}`/);
  assert.match(page, /aqlCode/);
  assert.match(page, /aqlName/);
  assert.match(page, /inspectionLevel/);
  assert.match(page, /aqlValue/);
  assert.match(page, /lotQtyFrom/);
  assert.match(page, /lotQtyTo/);
  assert.match(page, /sampleSize/);
  assert.match(page, /acceptQty/);
  assert.match(page, /rejectQty/);
});

test('AQL policy reference API exists for item master selectors', () => {
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const module = fs.readFileSync(modulePath, 'utf8');
  const policyEntity = fs.readFileSync(policyEntityPath, 'utf8');
  const migration = fs.readFileSync(migrationPath, 'utf8');

  assert.match(controller, /@Get\('policies'\)/);
  assert.match(controller, /findPolicies/);
  assert.match(module, /IqcAqlPolicy/);
  assert.match(policyEntity, /@Entity\(\{ name: 'IQC_AQL_POLICIES' \}\)/);
  assert.match(policyEntity, /policyCode: string/);
  assert.match(policyEntity, /majorAqlCode: string \| null/);
  assert.match(policyEntity, /minorAqlCode: string \| null/);
  assert.match(migration, /CREATE TABLE IQC_AQL_POLICIES/);
  assert.match(migration, /IQC_AQL_POLICY_CODE/);
  assert.match(migration, /DROP COLUMN INSPECTION_LEVEL/);
  assert.match(migration, /DROP COLUMN AQL_MAJOR/);
  assert.match(migration, /DROP COLUMN AQL_MINOR/);
});

test('AQL page manages IQC AQL policies, not only AQL standards', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const controller = fs.readFileSync(controllerPath, 'utf8');

  assert.match(controller, /@Post\('policies'\)/);
  assert.match(controller, /@Put\('policies\/:policyCode'\)/);
  assert.match(controller, /@Delete\('policies\/:policyCode'\)/);
  assert.match(page, /api\.get\(["']\/quality\/aql\/policies["']/);
  assert.match(page, /api\.post\(["']\/quality\/aql\/policies["']/);
  assert.match(page, /api\.put\(`\/quality\/aql\/policies\/\$\{encodeURIComponent\(policyForm\.policyCode\)\}`/);
  assert.match(page, /api\.delete\(`\/quality\/aql\/policies\/\$\{encodeURIComponent\(selectedPolicy\.policyCode\)\}`/);
  assert.match(page, /AQL 정책관리/);
  assert.match(page, /majorAqlCode/);
  assert.match(page, /minorAqlCode/);
  assert.match(page, /IQC_AQL_POLICIES/);
});

test('AQL policy management is the first top-left work area', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  const layoutStart = page.indexOf('<div className="grid grid-cols-12 gap-4 flex-1 min-h-0">');
  const policySection = page.indexOf('AQL 정책관리', layoutStart);
  const standardList = page.indexOf('exportFileName="AQL 기준관리"', layoutStart);
  const standardForm = page.indexOf('AQL 기준 등록', layoutStart);

  assert.notEqual(layoutStart, -1);
  assert.notEqual(policySection, -1);
  assert.notEqual(standardList, -1);
  assert.notEqual(standardForm, -1);
  assert.ok(policySection < standardList, 'AQL policy management should render before the AQL standard list');
  assert.ok(policySection < standardForm, 'AQL policy management should render before the AQL standard form');
});

test('AQL help text explains the policy-based model', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const help = fs.readFileSync(helpPath, 'utf8');

  assert.match(help, /AQL_STANDARDS\.AQL_CODE/);
  assert.match(help, /IQC_AQL_POLICIES\.MAJOR_AQL_CODE/);
  assert.match(help, /IQC_AQL_POLICIES\.MINOR_AQL_CODE/);
  assert.doesNotMatch(help, /품목\(ITEM_MASTERS\).*AQL 샘플링 기준/);

  for (const field of ['policyCode', 'policyName', 'policyInspectionLevel', 'policyMajorAqlCode', 'policyMinorAqlCode', 'policyUseYn']) {
    assert.match(help, new RegExp(`${field}: \\{`));
  }

  assert.match(page, /<HelpField field="policyCode" label="정책 코드" required>/);
  assert.match(page, /<HelpField field="policyName" label="정책명" required>/);
  assert.match(page, /<HelpField field="policyInspectionLevel" label="검사수준">/);
  assert.match(page, /<HelpField field="policyMajorAqlCode" label="Major AQL">/);
  assert.match(page, /<HelpField field="policyMinorAqlCode" label="Minor AQL">/);
  assert.match(page, /<HelpHeader field="policyCode" label="정책 코드" \/>/);
});

test('AQL policy panel fits without its own vertical scroll', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const policyCardStart = page.indexOf('<Card className="col-span-5 min-h-0 overflow-hidden" padding="none">');
  const standardCardStart = page.indexOf('<Card className="col-span-7 min-h-0 overflow-hidden" padding="none">');

  assert.notEqual(policyCardStart, -1);
  assert.notEqual(standardCardStart, -1);

  const policyCard = page.slice(policyCardStart, standardCardStart);
  assert.match(policyCard, /<CardContent className="h-full p-3 overflow-hidden flex flex-col">/);
  assert.match(policyCard, /<div className="grid grid-cols-3 gap-2 flex-shrink-0">/);
  assert.match(policyCard, /<div className="mt-3 flex-1 min-h-0">/);
  assert.doesNotMatch(policyCard, /overflow-auto/);
  assert.doesNotMatch(policyCard, /h-\[calc\(100%-224px\)\]/);
});

test('AQL standard toolbar add button is explicit', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /<Plus className="w-4 h-4" \/>AQL 기준 추가/);
  assert.doesNotMatch(page, /<Plus className="w-4 h-4" \/>\{t\("common\.add"\)\}/);
});
