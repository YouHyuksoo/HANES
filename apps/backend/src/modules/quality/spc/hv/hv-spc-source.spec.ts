/**
 * @file hv-spc-source.spec.ts
 * @description buildTargetData(관리한계·능력·규칙·health) 와 목업 소스 재현성 테스트
 */
import { buildTargetData, HEALTH_WINDOW, type SpcSubgroupRaw } from './hv-spc-source';
import { findSpcTarget, HV_SPC_TARGETS, type SpcTarget } from './hv-spc-targets';
import { generateMockSubgroups, MockSpcSource } from './hv-spc-mock.source';

const target: SpcTarget = {
  id: 'T1', processCode: 'P', processName: '공정', equipCodes: ['E1'], itemCode: 'I',
  characteristic: '특성', characteristicEn: 'Char', unit: 'mm', chartType: 'XBAR_R', subgroupSize: 5,
  spec: { lsl: 7, target: 10, usl: 13 }, decimals: 2,
};

const range = { dateFrom: '2026-08-06', dateTo: '2026-09-04' };

/** 평균 mean, 범위 2.326(σ=1) 인 서브그룹 n개 */
function stable(n: number, mean = 10): SpcSubgroupRaw[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1, date: '2026-09-01', time: '08:30', dateLabel: '09/01', equipCode: 'E1', lotNo: `L${i + 1}`,
    samples: [mean - 1.163, mean + 1.163, mean, mean - 0.5, mean + 0.5],
  }));
}

describe('buildTargetData', () => {
  it('서브그룹 xbar/range 계산과 요약 필드', () => {
    const data = buildTargetData(target, stable(3), { kLimit: 0 }, range, 'MOCK');
    expect(data.subgroups).toHaveLength(3);
    expect(data.subgroups[0].xbar).toBeCloseTo(10, 4);
    expect(data.subgroups[0].range).toBeCloseTo(2.326, 4);
    expect(data.sourceKind).toBe('MOCK');
    expect(data.target.subgroupCount).toBe(3);
    expect(data.target.lastSampleAt).toBe('2026-09-01 08:30');
    expect(data.target).not.toHaveProperty('itemName');
    expect(Object.keys(data)).toEqual(['target', 'dateFrom', 'dateTo', 'subgroups', 'stats', 'capability', 'violations', 'sourceKind']);
  });

  it('서브그룹 2개 미만이면 stats/capability null, health STABLE', () => {
    const data = buildTargetData(target, stable(1), { kLimit: 0 }, range, 'ORACLE');
    expect(data.stats).toBeNull();
    expect(data.capability).toBeNull();
    expect(data.violations).toEqual([]);
    expect(data.target.health).toBe('STABLE');
    expect(data.target.cpk).toBeNull();
  });

  it('빈 원자료(DB 데이터 없음)면 빈 결과 그대로', () => {
    const data = buildTargetData(target, [], { kLimit: 0 }, range, 'ORACLE');
    expect(data.subgroups).toEqual([]);
    expect(data.target.subgroupCount).toBe(0);
    expect(data.target.lastSampleAt).toBeNull();
  });

  it('Cpk: σ_within=1, 규격 7~13, 중심 10 → Cp=Cpk=1.0, health WARN(<1.33)', () => {
    const data = buildTargetData(target, stable(5), { kLimit: 0 }, range, 'MOCK');
    expect(data.capability?.cp).toBeCloseTo(1.0, 2);
    expect(data.capability?.cpk).toBeCloseTo(1.0, 2);
    expect(data.target.health).toBe('WARN');
  });

  it('단측 규격(USL만)이면 Cp null, Cpk 는 상한 쪽만', () => {
    const oneSided = { ...target, spec: { lsl: null, target: null, usl: 16 } };
    const data = buildTargetData(oneSided, stable(5), { kLimit: 0 }, range, 'MOCK');
    expect(data.capability?.cp).toBeNull();
    expect(data.capability?.cpk).toBeCloseTo(2.0, 2);
    expect(data.target.health).toBe('STABLE');
  });

  it('R1 이탈점이 최근 25개 안에 있으면 OOC, 그보다 오래되면 health 에서 제외', () => {
    const wide = { ...target, spec: { lsl: 0, target: 10, usl: 20 } };
    const withOutlier = (total: number, outlierIdx: number) => {
      const raw = stable(total);
      raw[outlierIdx] = { ...raw[outlierIdx], samples: [15, 15, 15, 15, 15] };
      return raw;
    };
    const recent = buildTargetData(wide, withOutlier(30, 29), { kLimit: 0 }, range, 'MOCK');
    expect(recent.violations.some((v) => v.rule === 'R1' && v.subgroupId === 30)).toBe(true);
    expect(recent.target.health).toBe('OOC');
    expect(recent.target.oocCount).toBeGreaterThanOrEqual(1);

    const old = buildTargetData(wide, withOutlier(40, 2), { kLimit: 0 }, range, 'MOCK');
    expect(old.violations.some((v) => v.rule === 'R1' && v.subgroupId === 3)).toBe(true);
    expect(old.violations.filter((v) => v.subgroupId > 40 - HEALTH_WINDOW && (v.rule === 'R1' || v.rule === 'RR1'))).toHaveLength(0);
    expect(old.target.health).not.toBe('OOC');
  });

  it('kLimit: 최근 k개만, id 재부여, totalAvailable 은 전체', () => {
    const data = buildTargetData(target, stable(10), { kLimit: 4 }, range, 'MOCK');
    expect(data.subgroups.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(data.subgroups[0].lotNo).toBe('L7');
    expect(data.stats?.totalAvailable).toBe(10);
    expect(data.stats?.kLimit).toBe(4);
  });
});

describe('MockSpcSource', () => {
  it('카탈로그 12건, 같은 입력이면 같은 데이터(시드 고정)', async () => {
    const src = new MockSpcSource();
    expect(src.kind).toBe('MOCK');
    expect(await src.listTargets()).toHaveLength(12);
    const t = findSpcTarget('GCRMP-CRIMP-H')!;
    const today = new Date(2026, 8, 4);
    const a = generateMockSubgroups(t, 30, today);
    const b = generateMockSubgroups(t, 30, today);
    expect(a).toEqual(b);
    expect(a[0].samples).toHaveLength(5);
    expect(a[0].lotNo).toMatch(/^VH1-RM\d{6}-\d{5}$/);
    // 일요일 제외
    expect(a.every((sg) => new Date(sg.date).getDay() !== 0)).toBe(true);
  });

  it('fetchSubgroupsMany 는 대상별 Map', async () => {
    const src = new MockSpcSource();
    const map = await src.fetchSubgroupsMany(HV_SPC_TARGETS.slice(0, 2), 7);
    expect([...map.keys()]).toEqual(['ATCUT-CUT-LEN', 'ATCUT-STRIP-LEN']);
    expect(map.get('ATCUT-CUT-LEN')!.length).toBeGreaterThan(0);
  });

  it('평균이동 대상(GCRMP-CRIMP-H, 30일)은 규칙 위반이 잡힌다', async () => {
    const t = findSpcTarget('GCRMP-CRIMP-H')!;
    const raw = generateMockSubgroups(t, 30, new Date(2026, 8, 4));
    const data = buildTargetData(t, raw, { kLimit: 0 }, range, 'MOCK');
    expect(data.violations.length).toBeGreaterThan(0);
  });
});
