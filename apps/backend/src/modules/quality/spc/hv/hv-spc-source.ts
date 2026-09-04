/**
 * @file hv-spc-source.ts
 * @description HV 하네스 SPC 데이터 소스 계약 + 공통 계산(관리한계·능력지수·규칙 판정).
 *
 * 초보자 가이드:
 * - 컨트롤러/서비스는 `SpcDataSource` 인터페이스만 본다. 구현체는 두 가지:
 *   `MockSpcSource`(hv-spc-mock.source.ts, 시드 고정 난수) 와 `DbSpcSource`(hv-spc-db.source.ts, SPC_CHARTS/SPC_DATA).
 * - 어느 소스를 쓸지는 시스템 설정 `SPC_HV_SOURCE`(MOCK|DB) 로 정한다 — hv-spc.service.ts 참고.
 * - 소스는 "서브그룹 원자료(측정값 묶음)" 만 돌려준다. 관리한계·Cpk·규칙은 여기 `buildTargetData` 가 계산한다.
 * - 응답 JSON 형태(SpcTargetSummary/SpcTargetData)는 원본 webdisplay 와 동일하게 유지한다. 프론트가 그 계약을 본다.
 * - 원본: C:\project\webdisplay\src\lib\hanes\spc-source.ts
 */
import { computeSpcStats, type SpcStats as BaseSpcStats } from './hv-spc-math';
import { evaluateSpcRules, type SpcRuleViolation } from './hv-spc-rules';
import type { SpcTarget } from './hv-spc-targets';

/** 서브그룹 원자료 — 소스가 돌려주는 최소 단위 */
export interface SpcSubgroupRaw {
  /** 조회 구간 안에서 1..n */
  id: number;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm */
  time: string;
  /** 차트 x축 라벨 (MM/DD 또는 MM/DD(n)) */
  dateLabel: string;
  equipCode: string;
  lotNo: string;
  samples: number[];
}

/** 화면용 서브그룹 — 원자료 + 통계 */
export interface SpcSubgroupRow extends SpcSubgroupRaw {
  xbar: number;
  range: number;
}

/** 공정능력 확장 — 단측 규격과 전체 산포(Ppk)까지 */
export interface SpcCapability {
  cp: number | null;
  cpk: number | null;
  pp: number | null;
  ppk: number | null;
  /** R̄/d2 (군내 산포) */
  sigmaWithin: number;
  /** 전체 표본 표준편차 (군간 포함) */
  sigmaOverall: number;
}

export type SpcHealth = 'STABLE' | 'WARN' | 'OOC';

export type SpcSourceKind = 'MOCK' | 'ORACLE';

export interface SpcTargetSummary {
  id: string;
  processCode: string;
  processName: string;
  itemCode: string;
  /** DB 소스에서만 존재 (ITEM_MASTERS 조인) — 목업 응답에는 키 자체가 없다 */
  itemName?: string;
  characteristic: string;
  characteristicEn: string;
  unit: string;
  subgroupSize: number;
  spec: SpcTarget['spec'];
  decimals: number;
  equipCodes: string[];
  /** 목록 화면용 요약 */
  cpk: number | null;
  health: SpcHealth;
  oocCount: number;
  warnCount: number;
  subgroupCount: number;
  lastSampleAt: string | null;
}

export interface SpcTargetData {
  target: SpcTargetSummary;
  dateFrom: string;
  dateTo: string;
  subgroups: SpcSubgroupRow[];
  stats: BaseSpcStats | null;
  capability: SpcCapability | null;
  violations: SpcRuleViolation[];
  /** 데이터 출처 표기 — 화면 배너용 */
  sourceKind: SpcSourceKind;
}

/** 관리대상 목록 응답 (원본 `?mode=targets`) */
export interface SpcTargetsResponse {
  sourceKind: SpcSourceKind;
  dateFrom: string;
  dateTo: string;
  targets: SpcTargetSummary[];
}

export interface SpcQuery {
  targetId: string;
  /** 오늘 포함 최근 N일 */
  days: number;
  /** 최근 k 서브그룹만 (0 = 전체) */
  kLimit: number;
}

/** 데이터 소스 계약 — 구현체는 원자료만 책임진다 */
export interface SpcDataSource {
  readonly kind: SpcSourceKind;
  listTargets(): Promise<SpcTarget[]>;
  fetchSubgroups(target: SpcTarget, days: number): Promise<SpcSubgroupRaw[]>;
  /**
   * 여러 관리대상의 서브그룹을 한 번에 — 목록 화면에서 관리대상마다 쿼리하는 N+1 을 피한다.
   * 키는 관리대상 id. 데이터가 없는 대상은 빈 배열.
   */
  fetchSubgroupsMany(targets: SpcTarget[], days: number): Promise<Map<string, SpcSubgroupRaw[]>>;
}

/* -- 공통 계산 -- */

function round(v: number, d: number): number {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function withStats(raw: SpcSubgroupRaw[], decimals: number): SpcSubgroupRow[] {
  return raw.map((sg) => {
    const n = sg.samples.length;
    const mean = sg.samples.reduce((s, v) => s + v, 0) / n;
    const range = Math.max(...sg.samples) - Math.min(...sg.samples);
    return { ...sg, xbar: round(mean, decimals + 2), range: round(range, decimals + 2) };
  });
}

/**
 * 공정능력 — hv-spc-math 는 양측 규격일 때만 Cp/Cpk 를 주므로,
 * 단측 규격(인장강도 LSL만, 누설전류 USL만)과 Ppk 는 여기서 보완한다.
 */
function computeCapability(rows: SpcSubgroupRow[], stats: BaseSpcStats, spec: SpcTarget['spec']): SpcCapability {
  const all = rows.flatMap((r) => r.samples);
  const n = all.length;
  const mean = all.reduce((s, v) => s + v, 0) / n;
  const sigmaOverall = n > 1 ? Math.sqrt(all.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)) : 0;
  const sigmaWithin = stats.sigmaEst;

  const oneSided = (sigma: number, center: number): number | null => {
    if (sigma <= 0) return null;
    const cpu = spec.usl !== null ? (spec.usl - center) / (3 * sigma) : null;
    const cpl = spec.lsl !== null ? (center - spec.lsl) / (3 * sigma) : null;
    if (cpu === null && cpl === null) return null;
    if (cpu === null) return cpl;
    if (cpl === null) return cpu;
    return Math.min(cpu, cpl);
  };
  const twoSided = (sigma: number): number | null =>
    spec.usl !== null && spec.lsl !== null && sigma > 0 ? (spec.usl - spec.lsl) / (6 * sigma) : null;

  const fix = (v: number | null) => (v === null ? null : Number(v.toFixed(3)));
  return {
    cp: fix(twoSided(sigmaWithin)),
    cpk: fix(oneSided(sigmaWithin, stats.xbarBar)),
    pp: fix(twoSided(sigmaOverall)),
    ppk: fix(oneSided(sigmaOverall, mean)),
    sigmaWithin: Number(sigmaWithin.toFixed(4)),
    sigmaOverall: Number(sigmaOverall.toFixed(4)),
  };
}

/**
 * 현재 상태 판정은 최근 HEALTH_WINDOW 서브그룹만 본다.
 * 관리도는 조회 기간 전체를 그리지만 "지금 관리상태인가"는 최근 상태의 문제다 —
 * 한 달 전 이상점 하나로 오늘 이탈이라고 하면 목록의 상태 점이 의미를 잃는다.
 * (α≈0.27%/점이라 100점을 보면 넷 중 하나는 우연 이탈이 나온다)
 */
export const HEALTH_WINDOW = 25;

function healthOf(violations: SpcRuleViolation[], cpk: number | null, lastId: number): SpcHealth {
  const recent = violations.filter((v) => v.subgroupId > lastId - HEALTH_WINDOW);
  if (recent.some((v) => v.rule === 'R1' || v.rule === 'RR1')) return 'OOC';
  if (recent.length > 0 || (cpk !== null && cpk < 1.33)) return 'WARN';
  return 'STABLE';
}

function limitRows(rows: SpcSubgroupRow[], kLimit: number): SpcSubgroupRow[] {
  if (kLimit <= 0 || rows.length <= kLimit) return rows;
  return rows.slice(-kLimit).map((r, i) => ({ ...r, id: i + 1 }));
}

/** 원자료 → 화면 데이터 (관리한계·능력·규칙) */
export function buildTargetData(
  target: SpcTarget,
  raw: SpcSubgroupRaw[],
  query: Pick<SpcQuery, 'kLimit'>,
  range: { dateFrom: string; dateTo: string },
  sourceKind: SpcSourceKind,
): SpcTargetData {
  const allRows = withStats(raw, target.decimals);
  const rows = limitRows(allRows, query.kLimit);

  let stats: BaseSpcStats | null = null;
  let capability: SpcCapability | null = null;
  let violations: SpcRuleViolation[] = [];

  if (rows.length >= 2) {
    stats = computeSpcStats(rows, target.spec, allRows.length, query.kLimit, target.subgroupSize);
    capability = computeCapability(rows, stats, target.spec);
    violations = evaluateSpcRules({
      subgroups: rows,
      xbar: { cl: stats.xbarCL, ucl: stats.xbarUCL, lcl: stats.xbarLCL },
      rUCL: stats.rUCL,
    });
  }

  const last = rows[rows.length - 1];
  const summary: SpcTargetSummary = {
    id: target.id,
    processCode: target.processCode,
    processName: target.processName,
    itemCode: target.itemCode,
    // 목업 응답 JSON 을 원본과 동일하게 유지하려고 itemName 은 값이 있을 때만 키를 만든다
    ...(target.itemName !== undefined ? { itemName: target.itemName } : {}),
    characteristic: target.characteristic,
    characteristicEn: target.characteristicEn,
    unit: target.unit,
    subgroupSize: target.subgroupSize,
    spec: target.spec,
    decimals: target.decimals,
    equipCodes: target.equipCodes,
    cpk: capability?.cpk ?? null,
    health: healthOf(violations, capability?.cpk ?? null, last?.id ?? 0),
    oocCount: violations.filter((v) => v.rule === 'R1' || v.rule === 'RR1').length,
    warnCount: violations.filter((v) => v.rule !== 'R1' && v.rule !== 'RR1').length,
    subgroupCount: rows.length,
    lastSampleAt: last ? `${last.date} ${last.time}` : null,
  };

  return { target: summary, dateFrom: range.dateFrom, dateTo: range.dateTo, subgroups: rows, stats, capability, violations, sourceKind };
}
