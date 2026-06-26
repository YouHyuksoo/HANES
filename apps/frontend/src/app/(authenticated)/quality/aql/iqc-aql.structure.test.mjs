import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const pagePath = 'apps/frontend/src/app/(authenticated)/quality/aql/page.tsx';
const controllerPath = 'apps/backend/src/modules/quality/aql/controllers/aql.controller.ts';
const modulePath = 'apps/backend/src/modules/quality/aql/aql.module.ts';
const policyEntityPath = 'apps/backend/src/entities/iqc-aql-policy.entity.ts';
const migrationPath = 'apps/backend/src/migrations/2026-06-21_iqc_aql_policy_code.sql';
const helpPath = 'apps/frontend/src/app/(authenticated)/quality/aql/components/AqlFieldHelp.tsx';
const isoMigrationPath = 'apps/backend/src/migrations/2026-06-26_iqc_aql_iso2859_redesign.sql';

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
  assert.match(page, /api\.get\(["']\/quality\/aql\/iso["']/);
  assert.match(page, /codeLetterRules/);
  assert.match(page, /codeLetterSamples/);
  assert.match(page, /acceptanceRules/);
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

test('AQL page manages ISO 2859 tables in page tabs', () => {
  const page = fs.readFileSync(pagePath, 'utf8');
  const controller = fs.readFileSync(controllerPath, 'utf8');
  const module = fs.readFileSync(modulePath, 'utf8');
  const migration = fs.readFileSync(isoMigrationPath, 'utf8');

  assert.match(page, /type AqlTab = "policies" \| "standards" \| "codeLetters" \| "samplingPlan"/);
  assert.match(page, /data-aql-tabs/);
  assert.match(page, /quality\.aql\.policySection/);
  assert.match(page, /quality\.aql\.standardTab/);
  assert.match(page, /quality\.aql\.codeLetterTab/);
  assert.match(page, /quality\.aql\.samplingPlanTab/);
  assert.match(page, /activeTab === "codeLetters" \|\| activeTab === "samplingPlan"/);
  assert.match(page, /fetchIsoTables\(\);/);
  assert.match(page, /quality\.aql\.isoLoadFailed/);
  assert.match(page, /Sample Size Code Letters/);
  assert.match(page, /Single Sampling Plans for Normal Inspection/);
  assert.match(page, /data-iso-code-letter-matrix/);
  assert.match(page, /data-iso-sampling-plan-matrix/);
  assert.match(page, /General Inspection Levels/);
  assert.match(page, /Special Inspection Levels/);
  assert.match(page, /Acceptable Quality Levels \(Normal Inspection\)/);
  assert.match(page, /SAMPLE SIZE CODE LETTERS/);
  assert.match(page, /SINGLE SAMPLING PLANS FOR NORMAL INSPECTION/);
  assert.match(page, /AQL_CODE_LETTER_RULES/);
  assert.match(page, /AQL_CODE_LETTER_SAMPLES/);
  assert.match(page, /AQL_ACCEPTANCE_RULES/);
  assert.match(page, /<IsoCodeLetterMatrix rules=\{codeLetterRules\} \/>/);
  assert.match(page, /<IsoSamplingPlanMatrix samples=\{codeLetterSamples\} acceptanceRules=\{acceptanceRules\} \/>/);
  assert.doesNotMatch(page, /columns=\{codeLetterColumns\}/);
  assert.doesNotMatch(page, /columns=\{acceptanceColumns\}/);
  assert.match(page, /isoRuleSection/);
  assert.doesNotMatch(page, /quality\.aql\.addRule/);
  assert.doesNotMatch(page, /LOT 수량별 판정기준을 추가하세요/);

  assert.match(controller, /@Get\('iso'\)/);
  assert.match(controller, /findIsoTables/);
  assert.match(module, /AqlCodeLetterRule/);
  assert.match(module, /AqlCodeLetterSample/);
  assert.match(module, /AqlAcceptanceRule/);
  assert.match(migration, /CREATE TABLE AQL_CODE_LETTER_RULES/);
  assert.match(migration, /CREATE TABLE AQL_CODE_LETTER_SAMPLES/);
  assert.match(migration, /CREATE TABLE AQL_ACCEPTANCE_RULES/);
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

  assert.match(page, /<HelpField field="policyCode" label=\{t\("quality\.aql\.policyCode", "정책 코드"\)\} required>/);
  assert.match(page, /<HelpField field="policyName" label=\{t\("quality\.aql\.policyName", "정책명"\)\} required>/);
  assert.match(page, /<HelpField field="policyInspectionLevel" label=\{t\("quality\.aql\.inspectionLevel", "검사수준"\)\}>/);
  assert.match(page, /<HelpField field="policyMajorAqlCode" label=\{t\("quality\.aql\.majorAql", "Major AQL"\)\}>/);
  assert.match(page, /<HelpField field="policyMinorAqlCode" label=\{t\("quality\.aql\.minorAql", "Minor AQL"\)\}>/);
});

test('AQL work areas are switched by page tabs', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /activeTab === "policies" \? "col-span-12 min-h-0 overflow-hidden" : "hidden"/);
  assert.match(page, /activeTab === "standards" \? "col-span-12 min-h-0 overflow-hidden" : "hidden"/);
  assert.match(page, /activeTab === "codeLetters" \? "col-span-12 min-h-0 overflow-hidden" : "hidden"/);
  assert.match(page, /activeTab === "samplingPlan" \? "col-span-12 min-h-0 overflow-hidden" : "hidden"/);
  assert.match(page, /activeTab === "standards" &&/);
  assert.match(page, /activeTab === "codeLetters" \|\| activeTab === "samplingPlan"/);
});

test('AQL standard toolbar add button is explicit', () => {
  const page = fs.readFileSync(pagePath, 'utf8');

  assert.match(page, /<Plus className="w-4 h-4" \/>\{t\("quality\.aql\.addStandard", "AQL 기준 추가"\)\}/);
  assert.doesNotMatch(page, /<Plus className="w-4 h-4" \/>\{t\("common\.add"\)\}/);
});
