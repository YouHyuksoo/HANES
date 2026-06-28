import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rules = fs.readFileSync('packages/shared/src/utils/process-capa-rules.ts', 'utf8');
const sharedIndex = fs.readFileSync('packages/shared/src/utils/index.ts', 'utf8');
const service = fs.readFileSync('apps/backend/src/modules/master/services/process-capa.service.ts', 'utf8');
const panel = fs.readFileSync('apps/frontend/src/app/(authenticated)/master/process-capa/components/CapaFormPanel.tsx', 'utf8');

test('process-capa CAPA 산식을 @harness/shared 단일 출처로 노출한다', () => {
  assert.match(rules, /export function calcStdUphFromTactTime\(stdTactTime: number\): number/);
  assert.match(rules, /export function capaMultiplier\(equipCnt: number, workerCnt: number\): number/);
  assert.match(rules, /export function calcDailyCapa\(\{[\s\S]*\}: DailyCapaInput\): number/);
  assert.match(sharedIndex, /export \* from '\.\/process-capa-rules'/);
});

test('백엔드 process-capa.service가 공유 산식을 사용한다(반올림·폴백은 호출부 유지)', () => {
  assert.match(service, /import \{ calcStdUphFromTactTime, calcDailyCapa \} from '@harness\/shared'/);
  // stdUph: 백엔드는 소수 2자리 반올림 유지
  assert.match(service, /Math\.round\(calcStdUphFromTactTime\([^)]*\) \* 100\) \/ 100/);
  // dailyCapa: 미입력 폴백(UPH 0, 효율 85)을 호출부에서 적용
  assert.match(service, /calcDailyCapa\(\{[\s\S]*stdUph: entity\.stdUph \|\| 0[\s\S]*balanceEffPct: entity\.balanceEff \|\| 85[\s\S]*\}\)/);
});

test('프론트 CapaFormPanel이 공유 산식을 사용한다(정수 반올림 유지)', () => {
  assert.match(panel, /import \{ calcStdUphFromTactTime, calcDailyCapa \} from "@harness\/shared"/);
  // stdUph: 프론트는 정수 반올림 유지
  assert.match(panel, /Math\.round\(calcStdUphFromTactTime\(value\)\)/);
  assert.match(panel, /calcDailyCapa\(\{[\s\S]*stdUph: form\.stdUph[\s\S]*balanceEffPct: form\.balanceEff[\s\S]*\}\)/);
});
