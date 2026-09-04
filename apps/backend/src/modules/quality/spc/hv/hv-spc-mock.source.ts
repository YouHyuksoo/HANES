/**
 * @file hv-spc-mock.source.ts
 * @description HV 하네스 SPC 목업 데이터 소스 — 시스템 설정 `SPC_HV_SOURCE=MOCK`(기본) 일 때 사용.
 *
 * 초보자 가이드:
 * - 관리대상 id 로 시드를 고정한 난수라서 새로고침해도 같은 데이터가 나온다(재현 가능).
 * - 정규분포 노이즈 위에 카탈로그의 `mock` 힌트(평균 이동·추세·이상점)를 얹어
 *   관리도 규칙(R1~R4, RR1) 이 실제로 걸리는 모습을 보여준다.
 * - 실 DB 소스는 hv-spc-db.source.ts 다. 설정을 DB 로 바꾸면 이 파일은 쓰이지 않는다. 화면은 영향 없다.
 * - 원본: C:\project\webdisplay\src\lib\hanes\spc-mock.ts
 */
import { HV_SPC_TARGETS, type SpcTarget } from './hv-spc-targets';
import type { SpcDataSource, SpcSubgroupRaw } from './hv-spc-source';
import { fmtDateLocal, fmtLabel, pad2, rangeStart } from './hv-spc-date';

export { fmtDateLocal } from './hv-spc-date';

/* -- 결정적 난수 -- */

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller 표준정규 */
function normal(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** 하루 안의 샘플링 시각 — perDay 만큼 앞에서 자른다 */
const SAMPLE_TIMES = ['08:30', '11:00', '14:30', '16:45'];

/**
 * 시드 솔트 — 목업이 "설명하기 좋은 모습"이 되도록 고른 상수.
 * 정규 노이즈만 있는 대상은 관리상태로, 평균이동·추세·이상점을 심은 대상만 규칙에 걸리게 한다.
 * 통계 자체를 조작하는 것이 아니라 어느 난수열을 쓸지 고르는 것뿐이다. 실 소스에서는 무의미하다.
 */
export const MOCK_SEED_SALT = 'hv-spc-v7';

/** mock 힌트가 없는 관리대상(DB 소스 전용)은 목업으로 생성할 수 없다 */
function requireMockShape(target: SpcTarget): NonNullable<SpcTarget['mock']> {
  if (!target.mock) throw new Error(`관리대상 ${target.id} 에 목업 힌트(mock)가 없습니다.`);
  return target.mock;
}

/**
 * 관리대상 하나의 서브그룹 원자료를 생성한다.
 * @param target 관리대상
 * @param days 오늘 포함 최근 N일
 * @param today 기준일 (테스트에서 고정하려고 주입)
 * @param salt 시드 솔트
 */
export function generateMockSubgroups(
  target: SpcTarget,
  days: number,
  today: Date = new Date(),
  salt: string = MOCK_SEED_SALT,
): SpcSubgroupRaw[] {
  const rand = mulberry32(hashSeed(`${salt}:${target.id}:${days}`));
  const m = requireMockShape(target);
  const perDay = Math.max(1, Math.min(SAMPLE_TIMES.length, m.perDay));
  const start = rangeStart(days, today);

  const out: SpcSubgroupRaw[] = [];
  let id = 1;
  let lotSeq = 1;
  for (let dayIdx = 0; dayIdx < days; dayIdx++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + dayIdx);
    // 일요일은 휴무
    if (d.getDay() === 0) continue;
    const dateKey = fmtDateLocal(d);
    const lotDate = `${String(d.getFullYear()).slice(2)}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;

    let offset = 0;
    if (m.shiftAtDay !== undefined && dayIdx >= m.shiftAtDay) offset += (m.shiftSigma ?? 0) * m.sigma;
    if (m.trendPerDay !== undefined) offset += m.trendPerDay * m.sigma * dayIdx;

    for (let k = 0; k < perDay; k++) {
      const equipCode = target.equipCodes[(id - 1) % target.equipCodes.length];
      const samples: number[] = [];
      for (let s = 0; s < target.subgroupSize; s++) {
        let v = m.mean + offset + normal(rand) * m.sigma;
        if (m.outlierAtSubgroup === id && s === 2) v += (m.outlierSigma ?? 0) * m.sigma;
        samples.push(Number(v.toFixed(target.decimals + 1)));
      }
      out.push({
        id,
        date: dateKey,
        time: SAMPLE_TIMES[k],
        dateLabel: perDay > 1 ? `${fmtLabel(d)}(${k + 1})` : fmtLabel(d),
        equipCode,
        lotNo: `VH1-RM${lotDate}-${String(lotSeq).padStart(5, '0')}`,
        samples,
      });
      id++;
      lotSeq++;
    }
  }
  return out;
}

/** 목업 소스 — 인터페이스 구현체 */
export class MockSpcSource implements SpcDataSource {
  readonly kind = 'MOCK' as const;

  async listTargets(): Promise<SpcTarget[]> {
    return HV_SPC_TARGETS;
  }

  async fetchSubgroups(target: SpcTarget, days: number): Promise<SpcSubgroupRaw[]> {
    return generateMockSubgroups(target, days);
  }

  async fetchSubgroupsMany(targets: SpcTarget[], days: number): Promise<Map<string, SpcSubgroupRaw[]>> {
    return new Map(targets.map((t) => [t.id, generateMockSubgroups(t, days)]));
  }
}
