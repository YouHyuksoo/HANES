/**
 * @file hv-spc-rules.spec.ts
 * @description Western Electric R1~R4 + RR1 규칙 판정 테스트
 */
import { evaluateSpcRules, flagBySubgroup } from './hv-spc-rules';

const limits = { cl: 10, ucl: 13, lcl: 7 }; // σ_x̄ = 1
const pts = (xbars: number[], range = 1) => xbars.map((xbar, i) => ({ id: i + 1, xbar, range }));

describe('hv-spc-rules', () => {
  it('R1: 관리한계 밖 1점', () => {
    const v = evaluateSpcRules({ subgroups: pts([10, 10, 13.5, 10]), xbar: limits, rUCL: 5 });
    expect(v).toEqual([{ subgroupId: 3, rule: 'R1', chart: 'XBAR', members: [3] }]);
  });

  it('R1: 하한 이탈도 잡는다', () => {
    const v = evaluateSpcRules({ subgroups: pts([10, 6.9]), xbar: limits, rUCL: 5 });
    expect(v.map((x) => x.rule)).toEqual(['R1']);
    expect(v[0].subgroupId).toBe(2);
  });

  it('R2: 연속 3점 중 2점이 같은 쪽 2σ 밖', () => {
    const v = evaluateSpcRules({ subgroups: pts([10, 12.5, 10, 12.5]), xbar: limits, rUCL: 5 });
    expect(v).toEqual([{ subgroupId: 4, rule: 'R2', chart: 'XBAR', members: [2, 4] }]);
  });

  it('R4: 연속 8점 같은 쪽 → 구간 하나로 합쳐진다', () => {
    const v = evaluateSpcRules({ subgroups: pts(Array(10).fill(10.5)), xbar: limits, rUCL: 5 });
    const r4 = v.filter((x) => x.rule === 'R4');
    expect(r4).toHaveLength(1);
    expect(r4[0].members).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(r4[0].subgroupId).toBe(10);
  });

  it('RR1: R 관리도 상한 이탈', () => {
    const subgroups = [
      { id: 1, xbar: 10, range: 1 },
      { id: 2, xbar: 10, range: 6 },
    ];
    const v = evaluateSpcRules({ subgroups, xbar: limits, rUCL: 5 });
    expect(v).toEqual([{ subgroupId: 2, rule: 'RR1', chart: 'R', members: [2] }]);
  });

  it('관리상태(중심선 주변 교대)면 위반 없음', () => {
    const v = evaluateSpcRules({ subgroups: pts([10.2, 9.8, 10.1, 9.9, 10.3, 9.7]), xbar: limits, rUCL: 5 });
    expect(v).toEqual([]);
  });

  it('flagBySubgroup: R1 은 OOC, 패턴 규칙은 구성점 전부 WARN', () => {
    const map = flagBySubgroup([
      { subgroupId: 3, rule: 'R1', chart: 'XBAR', members: [3] },
      { subgroupId: 4, rule: 'R2', chart: 'XBAR', members: [2, 4] },
    ]);
    expect(map.get(3)).toBe('OOC');
    expect(map.get(2)).toBe('WARN');
    expect(map.get(4)).toBe('WARN');
  });
});
