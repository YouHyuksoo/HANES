/**
 * @file hv-spc-math.ts
 * @description X̄-R 관리도 계산 — DB 와 무관한 순수 계산.
 *
 * 초보자 가이드:
 * - 이 파일은 DB 를 모른다. "서브그룹(측정값 묶음)" 목록만 받아 관리한계와 능력지수를 만든다.
 * - 관리도 상수(A2/D3/D4/d2)는 서브그룹 크기 n 에 종속이다. 원본(webdisplay)은 n=5 고정이었고,
 *   HANES 는 SPC_CHARTS.SUBGROUP_SIZE 가 2~10 까지 올 수 있어 상수표로 확장했다. n=5 값은 원본과 동일하다.
 * - 원본: C:\project\webdisplay\src\lib\mxvc\spc-math.ts
 */

/** 관리도 상수 (ASTM/ISO 7870) — 서브그룹 크기별 */
interface XbarRConstants {
  A2: number;
  D3: number;
  D4: number;
  d2: number;
}

const XBAR_R_CONSTANTS: Record<number, XbarRConstants> = {
  2: { A2: 1.88, D3: 0, D4: 3.267, d2: 1.128 },
  3: { A2: 1.023, D3: 0, D4: 2.575, d2: 1.693 },
  4: { A2: 0.729, D3: 0, D4: 2.282, d2: 2.059 },
  5: { A2: 0.577, D3: 0, D4: 2.114, d2: 2.326 },
  6: { A2: 0.483, D3: 0, D4: 2.004, d2: 2.534 },
  7: { A2: 0.419, D3: 0.076, D4: 1.924, d2: 2.704 },
  8: { A2: 0.373, D3: 0.136, D4: 1.864, d2: 2.847 },
  9: { A2: 0.337, D3: 0.184, D4: 1.816, d2: 2.97 },
  10: { A2: 0.308, D3: 0.223, D4: 1.777, d2: 3.078 },
};

/** 기본 서브그룹 크기 (원본 고정값) */
export const SUBGROUP_SIZE = 5;

/** 서브그룹 크기에 맞는 상수. 표에 없으면 예외 — 잘못된 상수로 조용히 계산하지 않는다. */
export function xbarRConstants(n: number): XbarRConstants {
  const c = XBAR_R_CONSTANTS[n];
  if (!c) throw new Error(`지원하지 않는 서브그룹 크기입니다: ${n} (2~10)`);
  return c;
}

export interface SpcSubgroup {
  id: number;
  date: string;
  dateLabel: string;
  samples: number[];
  xbar: number;
  range: number;
}

/** 스펙 한계. 없으면 null — Cp/Cpk 는 계산하지 않는다. */
export interface SpcSpecLimits {
  lsl: number | null;
  target: number | null;
  usl: number | null;
}

export interface SpcStats {
  xbarBar: number;
  rBar: number;
  xbarUCL: number;
  xbarLCL: number;
  xbarCL: number;
  rUCL: number;
  rLCL: number;
  rCL: number;
  /** 스펙이 없으면 null — 0 으로 내리면 '공정능력 0' 으로 오해된다 */
  cp: number | null;
  cpk: number | null;
  sigmaEst: number;
  usl: number | null;
  lsl: number | null;
  target: number | null;
  sampleSize: number;
  subgroupCount: number;
  totalAvailable: number;
  kLimit: number;
  oocPoints: number[];
}

/**
 * 최근 k 개만 남긴다. k <= 0 이면 전체.
 * id 는 1..n 으로 다시 매긴다 — 차트 x축과 이상점 클릭 매칭이 어긋나지 않게 한다.
 */
export function limitSubgroups<T extends { id: number }>(subgroups: T[], kLimit: number): T[] {
  if (kLimit <= 0 || subgroups.length <= kLimit) return subgroups;
  return subgroups.slice(-kLimit).map((sg, i) => ({ ...sg, id: i + 1 }));
}

/**
 * X̄-R 관리한계와 공정능력지수를 계산한다.
 *
 * 관리한계(UCL/LCL)는 데이터 자체에서 나오므로 스펙이 없어도 구해진다.
 * 반대로 Cp/Cpk 는 USL/LSL 없이는 정의되지 않는다 — 이때는 null 을 돌려주고
 * 화면이 '스펙 미설정'으로 표시하게 한다. 0 을 돌려주면 공정능력이 0 인 것처럼 보인다.
 */
export function computeSpcStats(
  limited: Pick<SpcSubgroup, 'id' | 'xbar' | 'range'>[],
  spec: SpcSpecLimits,
  totalAvailable: number,
  kLimit: number,
  subgroupSize: number = SUBGROUP_SIZE,
): SpcStats {
  const { A2, D3, D4, d2 } = xbarRConstants(subgroupSize);
  const k = limited.length;
  const xbarBar = limited.reduce((s, sg) => s + sg.xbar, 0) / k;
  const rBar = limited.reduce((s, sg) => s + sg.range, 0) / k;

  const xbarUCL = xbarBar + A2 * rBar;
  const xbarLCL = xbarBar - A2 * rBar;
  const sigmaEst = rBar / d2;

  const hasSpec = spec.lsl !== null && spec.usl !== null && sigmaEst > 0;
  const cp = hasSpec ? (spec.usl! - spec.lsl!) / (6 * sigmaEst) : null;
  const cpk = hasSpec
    ? Math.min((spec.usl! - xbarBar) / (3 * sigmaEst), (xbarBar - spec.lsl!) / (3 * sigmaEst))
    : null;

  return {
    xbarBar: Number(xbarBar.toFixed(4)),
    rBar: Number(rBar.toFixed(4)),
    xbarUCL: Number(xbarUCL.toFixed(4)),
    xbarLCL: Number(xbarLCL.toFixed(4)),
    xbarCL: Number(xbarBar.toFixed(4)),
    rUCL: Number((D4 * rBar).toFixed(4)),
    rLCL: Number((D3 * rBar).toFixed(4)),
    rCL: Number(rBar.toFixed(4)),
    cp: cp === null ? null : Number(cp.toFixed(3)),
    cpk: cpk === null ? null : Number(cpk.toFixed(3)),
    sigmaEst: Number(sigmaEst.toFixed(4)),
    usl: spec.usl,
    lsl: spec.lsl,
    target: spec.target,
    sampleSize: subgroupSize,
    subgroupCount: k,
    totalAvailable,
    kLimit,
    oocPoints: limited.filter((sg) => sg.xbar > xbarUCL || sg.xbar < xbarLCL).map((sg) => sg.id),
  };
}
