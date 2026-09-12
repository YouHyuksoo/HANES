/**
 * @file e2e/scenario-runner/validate.ts
 * @description 시나리오 JSON 파싱 단계 검증 (규격서 10절)
 *
 * 실행 전에 거른다. 작성 스킬(일 4)도 이 함수를 재사용해
 * "AI 가 생성한 시나리오가 규격에 맞는지"를 같은 규칙으로 확인한다.
 */
import { VAR_PATTERN } from './engine';
import { hasResolvableKey } from './selector';
import type { Scenario, ScenarioStep } from './types';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BUILTIN_VARS = new Set(['stamp', 'reportDate', 'runId']);

function allSteps(scenario: Scenario): ScenarioStep[] {
  return [...(scenario.setup ?? []), ...scenario.steps, ...(scenario.teardown ?? [])];
}

/** 문자열 안의 {{변수}} 이름을 모아 준다 */
function referencedVars(step: ScenarioStep): string[] {
  const found: string[] = [];
  const scan = (value: unknown) => {
    if (typeof value === 'string') {
      // engine.render 와 반드시 같은 패턴을 쓴다 — 다르면 "치환은 되는데 검증은 안 되는"
      // (또는 그 반대) 구멍이 생긴다.
      for (const m of value.matchAll(new RegExp(VAR_PATTERN.source, 'g'))) found.push(m[1]);
    } else if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(scan);
    }
  };
  scan(step.target);
  scan(step.value);
  scan(step.path);
  scan(step.expect);
  scan(step.alreadyDone);
  scan(step.expectApi);
  return found;
}

export function validateScenario(scenario: Scenario, fileBaseName: string): string[] {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (scenario.schemaVersion !== 1) errors.push(`schemaVersion 은 1 이어야 한다 (현재 ${scenario.schemaVersion})`);
  if (scenario.id !== fileBaseName) errors.push(`id("${scenario.id}") 가 파일명("${fileBaseName}") 과 다르다`);

  const steps = allSteps(scenario);
  const hasWrite = steps.some(
    (s) => (s.action === 'api' && WRITE_METHODS.has((s.method ?? 'GET').toUpperCase()))
      || s.action === 'cleanupPrefix',
  );
  if (scenario.dataPolicy === 'readonly' && hasWrite) {
    errors.push('dataPolicy=readonly 인데 쓰기 api 또는 cleanupPrefix 가 있다');
  }
  if (scenario.dataPolicy === 'creates') {
    if (!scenario.vars?.prefix) errors.push('dataPolicy=creates 에는 vars.prefix 가 필요하다');
    if (!scenario.teardown?.length) errors.push('dataPolicy=creates 에는 teardown 이 필요하다');
  }

  // 앞선 capture 가 만든 변수까지 누적하며 검사한다
  const known = new Set<string>([...BUILTIN_VARS, ...Object.keys(scenario.vars ?? {})]);

  steps.forEach((step, i) => {
    const where = `[${i}] ${step.action}`;

    if (step.target && !hasResolvableKey(step.target)) {
      errors.push(`${where}: target 에 해석 가능한 키가 없다 — ${JSON.stringify(step.target)}`);
    }
    if (step.action === 'cleanupPrefix') {
      if (!scenario.vars?.prefix) errors.push(`${where}: cleanupPrefix 에는 vars.prefix 가 필요하다`);
      if (!step.path) errors.push(`${where}: cleanupPrefix 에는 path 가 필요하다`);
      if (!step.prefixField) errors.push(`${where}: cleanupPrefix 에는 prefixField 가 필요하다`);
    }
    if (step.action === 'waitMs' && !step.note) {
      errors.push(`${where}: waitMs 에는 이유를 적은 note 가 필요하다 (고정 대기 남용 방지)`);
    }
    if (step.expect && Object.keys(step.expect).length === 1 && step.expect.type) {
      warnings.push(`${where}: expect 가 { type } 단독이라 느슨하다 — messageIncludes/pathIncludes 를 함께 주면 오판이 준다`);
    }
    for (const name of referencedVars(step)) {
      if (!known.has(name)) errors.push(`${where}: 해석할 수 없는 변수 {{${name}}}`);
    }
    if (step.as) known.add(step.as);
  });

  for (const w of warnings) console.warn(`[validate] 경고 ${w}`);
  return errors;
}
