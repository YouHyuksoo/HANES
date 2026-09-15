import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const sourceUrl = new URL('./quality-control-plan.rules.ts', import.meta.url);

async function loadRules() {
  if (!existsSync(sourceUrl)) return {};

  const source = readFileSync(sourceUrl, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const rules = await loadRules();

test('RPN은 심각도, 발생도, 검출도의 곱으로 계산한다', () => {
  assert.equal(typeof rules.calculateRpn, 'function');
  assert.equal(rules.calculateRpn(8, 4, 3), 96);
});

test('2자리 Revision 코드를 순차 증가시킨다', () => {
  assert.equal(rules.nextRevisionCode('00'), '01');
  assert.equal(rules.nextRevisionCode('09'), '10');
});

test('100% 검사에는 별도 검사주기를 허용하지 않는다', () => {
  const issues = rules.validateQualityPlan({
    processFlowRows: [{ id: 1, processNo: '10' }],
    pfmeaRows: [],
    controlPlanRows: [{ id: 31, processFlowRowId: 1, sampleSize: '100%', sampleFrequency: '매 LOT' }],
  });

  assert.ok(issues.some((issue) => issue.code === 'CP_FREQUENCY_WITH_100_PERCENT'));
});

test('PFMEA와 Control Plan의 PFD 공정 참조 불일치를 찾는다', () => {
  const issues = rules.validateQualityPlan({
    processFlowRows: [{ id: 1, processNo: '10' }],
    pfmeaRows: [{ id: 21, processFlowRowId: 999 }],
    controlPlanRows: [{ id: 31, processFlowRowId: 998 }],
  });

  assert.ok(issues.some((issue) => issue.code === 'PFMEA_PROCESS_NOT_IN_PFD' && issue.rowId === 21));
  assert.ok(issues.some((issue) => issue.code === 'CP_PROCESS_NOT_IN_PFD' && issue.rowId === 31));
});

test('특별특성 PFMEA 행은 Control Plan 행에 연결되어야 한다', () => {
  const issues = rules.validateQualityPlan({
    processFlowRows: [{ id: 1, processNo: '10' }],
    pfmeaRows: [{ id: 21, processFlowRowId: 1, specialCharacteristicCode: 'SAFETY' }],
    controlPlanRows: [{ id: 31, processFlowRowId: 1 }],
  });

  assert.ok(issues.some((issue) => issue.code === 'SPECIAL_CHARACTERISTIC_NOT_CONTROLLED' && issue.rowId === 21));
});

test('Control Plan의 일반 PFMEA 연결도 현재 참조 Revision에 존재해야 한다', () => {
  const issues = rules.validateQualityPlan({
    processFlowRows: [{ id: 1, processNo: '10' }],
    pfmeaRows: [{ id: 22, processFlowRowId: 1 }],
    controlPlanRows: [{ id: 31, processFlowRowId: 1, pfmeaRowId: 21 }],
  });

  assert.ok(issues.some((issue) => issue.code === 'CONTROL_PLAN_PFMEA_REFERENCE_MISMATCH' && issue.rowId === 31));
});
