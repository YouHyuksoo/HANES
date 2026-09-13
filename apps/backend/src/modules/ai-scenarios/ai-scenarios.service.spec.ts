import { validateScenario } from './ai-scenarios.service';
import type { Scenario } from './scenario.types';

/**
 * 검증은 적재 시점에 돈다. 규격을 어긴 시나리오는 배포돼도 실행되지 않아야 한다.
 * 작성 스킬(AI)도 같은 규칙으로 생성물을 자체 검증한다.
 */
const base: Scenario = {
  schemaVersion: 1,
  id: 'sample',
  title: '샘플',
  description: '샘플 절차',
  startRoute: '/production/order',
  params: { itemCode: { label: '품목', required: true } },
  steps: [
    { action: 'goto', value: '/production/order' },
    { action: 'click', target: { testId: 'x' } },
  ],
};

describe('validateScenario', () => {
  it('정상 시나리오는 오류가 없다', () => {
    expect(validateScenario(base, 'sample')).toEqual([]);
  });

  it('id 와 파일명이 다르면 거부한다', () => {
    expect(validateScenario(base, 'other').join()).toContain('파일명');
  });

  it('description 이 없으면 거부한다 — AI 가 이걸 읽고 고른다', () => {
    expect(validateScenario({ ...base, description: '  ' }, 'sample').join()).toContain('description');
  });

  it('target 에 해석 가능한 키가 없으면 거부한다', () => {
    const bad = { ...base, steps: [{ action: 'click' as const, target: { row: '행만' } }] };
    expect(validateScenario(bad, 'sample').join()).toContain('해석 가능한 키');
  });

  it('params 에 없는 값을 쓰면 거부한다 — 시나리오는 절차만 담는다', () => {
    const bad = {
      ...base,
      steps: [{ action: 'fill' as const, target: { testId: 'q' }, value: '{{없는값}}' }],
    };
    expect(validateScenario(bad, 'sample').join()).toContain('정의되지 않은 값');
  });

  it('capture 결과는 이후 스텝에서 쓸 수 있다', () => {
    const ok = {
      ...base,
      steps: [
        { action: 'capture' as const, target: { testId: 'a' }, as: 'orderNo' },
        { action: 'fill' as const, target: { testId: 'b' }, value: '{{orderNo}}' },
      ],
    };
    expect(validateScenario(ok, 'sample')).toEqual([]);
  });

  it('waitMs 에 이유가 없으면 거부한다 — 고정 대기 남용 방지', () => {
    const bad = { ...base, steps: [{ action: 'waitMs' as const, value: '1000' }] };
    expect(validateScenario(bad, 'sample').join()).toContain('note');
  });
});
